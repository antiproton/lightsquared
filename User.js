define(function(require) {
	require("lib/Array.contains");
	require("lib/Array.remove");
	var id = require("lib/id");
	var time = require("lib/time");
	var Event = require("lib/Event");
	var Glicko2 = require("glicko2").Glicko2;
	var glicko2Constants = require("jsonchess/glicko2");
	var PieceType = require("chess/PieceType");
	var Player = require("./Player");
	var Square = require("chess/Square");
	var Move = require("jsonchess/Move");
	
	var ANONYMOUS_USERNAME = "Anonymous";
	var MAX_IDLE_TIME_ANONYMOUS = 1000 * 60 * 60 * 24;
	var MAX_IDLE_TIME_LOGGED_IN = 1000 * 60 * 60 * 24 * 30;
	var INACTIVE_GAMES_EXPIRE = 1000 * 60 * 5;
	
	function User(user, app, db) {
		this._id = id();
		this._db = db;
		this._user = user;
		this._app = app;
		this._isWatchingRandomGames = false;
		this._randomGames = this._app.getRandomGames();
		this._subscriptions = {};
		
		this.Connected = new Event();
		this.Disconnected = new Event();
		this.LoggedIn = new Event();
		this.LoggedOut = new Event();
		
		this._gamesPlayedAsWhite = 0;
		this._gamesPlayedAsBlack = 0;
		
		this._username = ANONYMOUS_USERNAME;
		this._isLoggedIn = false;
		this._player = new Player(this);
		
		this._glicko2 = this._getInitialGlicko2();
		this._recentRatedResults = [];
		
		this._currentGames = [];
		this._currentSeek = null;
		this._lastSeekOptions = null;
		this._pendingRestorationRequests = [];
		
		this._prefs = {
			premove: true,
			alwaysQueen: false,
			pieceStyle: null,
			boardSize: null,
			boardStyle: null
		};
		
		this._handlers = [
			this._app.NewSeek.addHandler(function(seek) {
				this._user.send("/open_seek/new", seek);
			}, this),
			
			this._app.SeekExpired.addHandler(function(id) {
				this._user.send("/open_seek/expired", id);
			}, this),
			
			this._user.Disconnected.addHandler(function() {
				this._removeInactiveGames();
				this.Disconnected.fire();
			}, this),
			
			this._user.Connected.addHandler(function() {
				this.Connected.fire();
			}, this),
			
			this._user.CheckingActivity.addHandler(function(activityCheck) {
				if(this._isActive()) {
					activityCheck.registerActivity();
				}
			}, this),
			
			this._user.Deregistering.addHandler(function() {
				this._handlers.forEach(function(handler) {
					handler.remove();
				});
				
				this._updateDb();
				this.logout();
			}, this)
		];
		
		this._setupRandomGamesHandlers();
		this._subscribeToUserMessages();
	}
	
	User.prototype._setupRandomGamesHandlers = function() {
		this._randomGamesHandlers = [
			this._randomGames.Move.addHandler(function(data) {
				if(data.game.isInProgress()) {
					this._sendRandomGame(data.game, data.move);
				}
			}, this),
			this._randomGames.GameOver.addHandler(function(game) {
				this._user.send("/random_game/game_over", game.getId());
			}, this),
			this._randomGames.NewGame.addHandler(function(game) {
				this._sendRandomGame(game);
			}, this)
		];
		
		this._removeRandomGamesHandlers();
	}
	
	User.prototype._sendRandomGame = function(game, lastMove) {
		this._user.send("/random_game", {
			id: game.getId(),
			fen: game.getPosition().getFen(),
			lastMove: (lastMove ? {
				from: lastMove.getFrom().squareNo,
				to: lastMove.getTo().squareNo
			} : null)
		});
	}
	
	User.prototype._addRandomGamesHandlers = function() {
		if(!this._isWatchingRandomGames) {
			this._randomGamesHandlers.forEach(function(handler) {
				handler.add();
			});
			
			this._isWatchingRandomGames = true;
		}
	}
	
	User.prototype._removeRandomGamesHandlers = function() {
		if(this._isWatchingRandomGames) {
			this._randomGamesHandlers.forEach(function(handler) {
				handler.remove();
			});
			
			this._isWatchingRandomGames = false;
		}
	}
	
	User.prototype.replace = function(user) {
		this._loadJson(user.getPersistentJson());
		this._player = user.getPlayer();
		this._player.setUser(this);
		
		user.getCurrentGames().forEach((function(game) {
			this._addGame(game);
		}).bind(this));
		
		user.logout();
	}
	
	User.prototype.getPlayer = function() {
		return this._player;
	}
	
	User.prototype.getId = function() {
		return this._id;
	}
	
	User.prototype._login = function(username, password) {
		var error = null;
		
		if(this._isLoggedIn) {
			error = "You are already logged in";
		}
		
		else if(this._hasGamesInProgress()) {
			error = "You must finish all games before logging in";
		}
		
		if(error === null) {
			this._db.findOne({
				username: username,
				password: password
			}, (function(error, user) {
				if(user) {
					this._loadJson(user);
					this._isLoggedIn = true;
					this._cancelCurrentSeek();
					this.LoggedIn.fire();
					this._user.send("/user/login/success", this._getPrivateJson());
				}
				
				else {
					this._user.send("/user/login/failure", "Username/password combination not recognised");
				}
			}).bind(this));
		}
		
		else {
			this._user.send("/user/login/failure", error);
		}
	}
	
	User.prototype.logout = function() {
		if(this._isLoggedIn) {
			this._isLoggedIn = false;
			this._cancelCurrentSeek();
			this._currentGames = [];
			this._username = ANONYMOUS_USERNAME;
			this._player = new Player(this);
			this.LoggedOut.fire();
			this._user.send("/user/logout", this._player.getId());
		}
	}
	
	User.prototype._register = function(username, password) {
		var error = null;
		var autoLogin = true;
		
		if(this._isLoggedIn || this._hasGamesInProgress()) {
			autoLogin = false;
		}
		
		else if(username.trim() !== username) {
			error = "Username must not begin or end with whitespace";
		}
		
		else if(username === "") {
			error = "Username must be at least 1 character long";
		}
		
		else if(username === ANONYMOUS_USERNAME) {
			error = "'" + ANONYMOUS_USERNAME + "' is reserved for anonymous users";
		}
		
		else if(password === "") {
			error = "Password must be at least 1 character long";
		}
		
		if(error === null) {
			this._db.findOne({
				username: username
			}, (function(error, existingUser) {
				if(!existingUser) {
					var user = this._getInitialRegistrationJson(username, password);
					
					this._db.save(user, (function(error) {
						if(!error) {
							if(autoLogin) {
								this._loadJson(user);
								this._isLoggedIn = true;
								this._cancelCurrentSeek();
								
								this.LoggedIn.fire({
									username: username
								});
							}
							
							this._user.send("/user/register/success", autoLogin ? this._getPrivateJson() : null);
						}
						
						else {
							this._user.send("/user/register/failure", "Server error: " + error);
						}
					}).bind(this));
				}
				
				else {
					this._user.send("/user/register/failure", "The username '" + username + "' is already registered");
				}
			}).bind(this));
		}
		
		else {
			this._user.send("/user/register/failure", error);
		}
	}
	
	User.prototype._updateDb = function() {
		if(this._isLoggedIn) {
			this._db.update({
				username: this._username
			}, {
				$set: this.getPersistentJson()
			}, function() {});
		}
	}
	
	User.prototype.getUsername = function() {
		return this._username;
	}
	
	User.prototype.getRating = function() {
		return this._glicko2.rating;
	}
	
	User.prototype.getGlicko2 = function() {
		return this._glicko2;
	}
	
	User.prototype.isLoggedIn = function() {
		return this._isLoggedIn;
	}
	
	User.prototype._isActive = function() {
		var timeLastActive = this._user.getTimeLastActive();
		var maxIdleTime = this._isLoggedIn ? MAX_IDLE_TIME_LOGGED_IN : MAX_IDLE_TIME_ANONYMOUS;
		
		return (timeLastActive >= time() - maxIdleTime || this._hasGamesInProgress());
	}
	
	User.prototype._subscribeToUserMessages = function() {
		var subscriptions = {
			"/user/login": function(data) {
				this._login(
					(data.username || "").toString(),
					(data.password || "").toString()
				);
			},
			
			"/user/logout": function() {
				this._currentGames.forEach((function(game) {
					game.resign(this._player);
				}).bind(this));
				
				this._updateDb();
				this.logout();
			},
			
			"/user/register": function(data) {
				this._register(
					(data.username || "").toString(),
					(data.password || "").toString()
				);
			},
			
			"/seek": function(options) {
				this._seekGame(options);
			},
			
			"/seek/cancel": function() {
				this._cancelCurrentSeek();
			},
			
			"/seek/accept": function(id) {
				this._acceptSeek(id);
			},
			
			"/request/game": function(id, client) {
				var game = this._spectateGame(id);
				
				if(game) {
					client.send("/game", game);
				}
				
				else {
					client.send("/game/not_found", id);
				}
			},
			
			"/request/games": function(data, client) {
				client.send("/games", this._currentGames)
			},
			
			"/request/user": function(data, client) {
				client.send("/user", this._getPrivateJson());
			},
			
			"/request/open_seeks": function(data, client) {
				client.send("/open_seeks", this._app.getOpenSeeks());
			},
			
			"/user/prefs/update": function(prefs) {
				for(var pref in this._prefs) {
					if(pref in prefs) {
						this._prefs[pref] = prefs[pref];
					}
				}
			},
			
			"/request/time": function(requestId, client) {
				client.send("/time/" + requestId, time());
			},
			
			"/game/restore": function(backup) {
				this._restoreGame(backup);
			},
			
			"/game/restore/cancel": function(id) {
				this._cancelRestoration(id);
			},
			
			"/request/restoration_requests": function(data, client) {
				client.send("/restoration_requests", this._pendingRestorationRequests);
			},
			
			"/random_games/subscribe": function(data, client) {
				this._addRandomGamesHandlers();
				
				this._randomGames.getGames().forEach((function(game) {
					this._sendRandomGame(game);
				}).bind(this));
			},
			
			"/random_games/unsubscribe": function() {
				this._removeRandomGamesHandlers();
			}
		};

		for(var url in subscriptions) {
			this._user.subscribe(url, subscriptions[url].bind(this));
		}
	}
	
	User.prototype._subscribeToGameMessages = function(game) {
		var id = game.getId();
		var subscriptions = this._subscriptions["/game/" + id] = {};
		
		subscriptions["/game/" + id + "/request/moves"] = function(startingIndex) {
			var index = startingIndex;
			
			game.getHistory().slice(index).forEach((function(move) {
				this._user.send("/game/" + id + "/move", Move.getShortJSON(move, index));
			
				index++;
			}).bind(this));
		};
		
		subscriptions["/game/" + id + "/chat"] = function(message) {
			if(message.length > 0) {
				game.chat(this._player, message);
			}
		};
		
		subscriptions["/game/" + id + "/move"] = function(data) {
			var promoteTo = (data.promoteTo ? PieceType.fromSanString(data.promoteTo) : undefined);
			
			game.move(this._player, Square.fromSquareNo(data.from), Square.fromSquareNo(data.to), promoteTo);
		};
		
		subscriptions["/game/" + id + "/premove"] = function(data) {
			var promoteTo = (data.promoteTo ? PieceType.fromSanString(data.promoteTo) : undefined);
			var from = Square.fromSquareNo(data.from);
			var to = Square.fromSquareNo(data.to);
			
			if(game.getPlayerColour(this._player) === game.getActiveColour()) {
				game.move(this._player, from, to, promoteTo);
			}
			
			else {
				game.premove(this._player, from, to, promoteTo);
			}
		};
		
		subscriptions["/game/" + id + "/request/premove"] = function() {
			if(game.getPlayerColour(this._player) === game.getActiveColour().opposite) {
				this._user.send("/game/" + id + "/premove", game.getPendingPremove());
			}
		};
		
		subscriptions["/game/" + id + "/premove/cancel"] = function() {
			game.cancelPremove(this._player);
		};
		
		subscriptions["/game/" + id + "/resign"] = function() {
			game.resign(this._player);
		};
		
		subscriptions["/game/" + id + "/offer_draw"] = function() {
			game.offerDraw(this._player);
		};
		
		subscriptions["/game/" + id + "/claim_draw"] = function() {
			game.claimDraw(this._player);
		};
		
		subscriptions["/game/" + id + "/accept_draw"] = function() {
			game.acceptDraw(this._player);
		};
		
		subscriptions["/game/" + id + "/rematch"] = function() {
			game.offerRematch(this._player);
		};
		
		subscriptions["/game/" + id + "/rematch/decline"] = function() {
			game.declineRematch(this._player);
		};
		
		subscriptions["/game/" + id + "/rematch/cancel"] = function() {
			game.cancelRematchOffer(this._player);
		};
		
		var subscription;
		
		for(var url in subscriptions) {
			subscription = subscriptions[url].bind(this);
			
			this._subscriptions["/game/" + id][url] = subscription;
			this._user.subscribe(url, subscription);
		}
	}
	
	User.prototype._seekGame = function(options) {
		this._cancelCurrentSeek();
		
		var rating = this.getRating();
		
		var existingSeek = this._app.getOpenSeeks().filter((function(seek) {
			return (seek.matchesOptions(options) && seek.matchesPlayer(this._player));
		}).bind(this)).sort(function(seekA, seekB) {
			return Math.abs(rating - seekA.getOwnerRating()) - Math.abs(rating - seekB.getOwnerRating());
		})[0];
		
		if(existingSeek) {
			var game = existingSeek.accept(this._player);
			
			if(game !== null) {
				this._addGame(game);
				this._user.send("/seek/matched", game);
			}
		}
		
		else {
			try {
				var seek = this._app.createSeek(this._player, options);
				
				seek.Matched.addHandler(function(game) {
					this._currentSeek = null;
					this._addGame(game);
					this._user.send("/seek/matched", game);
				}, this);
				
				seek.Expired.addHandler(function() {
					this._user.send("/seek/expired");
					this._currentSeek = null;
				}, this);
				
				this._currentSeek = seek;
				this._lastSeekOptions = options;
				
				this._user.send("/seek/waiting", seek);
			}
			
			catch(error) {
				this._user.send("/seek/error", error);
			}
		}
	}
	
	User.prototype._acceptSeek = function(id) {
		var seek = this._app.getSeek(id);
		
		if(seek !== null) {
			var game = seek.accept(this._player);
			
			if(game !== null) {
				this._addGame(game);
				this._user.send("/seek/matched", game);
				this._cancelCurrentSeek();
			}
		}
	}
	
	User.prototype._cancelCurrentSeek = function() {
		if(this._currentSeek !== null) {
			this._currentSeek.cancel();
		}
	}
	
	User.prototype._addGame = function(game) {
		var id = game.getId();
		
		this._currentGames.push(game);
		this._subscribeToGameMessages(game);
		
		game.Move.addHandler(function(move) {
			this._user.send("/game/" + id + "/move", Move.getShortJSON(move, game.getHistory().length - 1));
		}, this);
		
		game.Aborted.addHandler(function() {
			this._currentGames.remove(game);
			this._user.send("/game/" + id + "/aborted");
		}, this);
		
		game.DrawOffered.addHandler(function() {
			this._user.send("/game/" + id + "/draw_offer", game.getActiveColour().opposite.fenString);
		}, this);
		
		game.Rematch.addHandler(function(game) {
			this._addGame(game);
			this._user.send("/game/" + id + "/rematch", game);
		}, this);
		
		game.GameOver.addHandler(function(result) {
			if(this._isPlayer(game)) {
				this._registerCompletedRatedGame(game);
			}
			
			this._user.send("/game/" + id + "/game_over", result);
		}, this);
		
		game.Chat.addHandler(function(data) {
			if(!this._isPlayer(game) || game.playerIsPlaying(data.player)) {
				this._user.send("/game/" + id + "/chat", {
					from: data.player.getName(),
					body: data.message
				});
			}
		}, this);
		
		if(this._isPlayer(game)) {
			game.RematchOffered.addHandler(function(player) {
				this._user.send("/game/" + id + "/rematch/offered", game.getPlayerColour(player));
			}, this);
			
			game.RematchDeclined.addHandler(function() {
				this._user.send("/game/" + id + "/rematch/declined");
			}, this);
			
			game.RematchOfferCanceled.addHandler(function() {
				this._user.send("/game/" + id + "/rematch/canceled");
			}, this);
			
			game.RematchOfferExpired.addHandler(function() {
				this._user.send("/game/" + id + "/rematch/expired");
			}, this);
		}
	}
	
	User.prototype._isPlayer = function(game) {
		return game.playerIsPlaying(this._player);
	}
	
	User.prototype._removeInactiveGames = function() {
		this._currentGames = this._currentGames.filter((function(game) {
			if(game.isInProgress() || time() - game.getEndTime() < INACTIVE_GAMES_EXPIRE) {
				return true;
			}
			
			else {
				this._removeSubscriptions("/game/" + game.getId());
				
				return false;
			}
		}).bind(this));
	}
	
	User.prototype._removeSubscriptions = function(id) {
		for(var url in this._subscriptions[id]) {
			this._user.unsubscribe(url, this._subscriptions[id][url]);
		}
		
		delete this._subscriptions[id];
	}
	
	User.prototype._getGame = function(id) {
		var game = null;
		
		this._currentGames.some(function(sessionGame) {
			if(sessionGame.getId() === id) {
				game = sessionGame;
				
				return true;
			}
		});
		
		return (game || this._app.getGame(id));
	}
	
	User.prototype.getCurrentGames = function() {
		return this._currentGames.getShallowCopy();
	}
	
	User.prototype._spectateGame = function(id) {
		var game = this._getGame(id);
		
		if(game && !this._currentGames.contains(game)) {
			this._addGame(game);
		}
		
		return game;
	}
	
	User.prototype._hasGamesInProgress = function() {
		return this._currentGames.some((function(game) {
			return (game.isInProgress() && this._isPlayer(game));
		}).bind(this));
	}
	
	User.prototype._restoreGame = function(backup) {
		var id = backup.gameDetails.id;
		var request = this._app.restoreGame(this._player, backup);
		
		if(!request.isFinished()) {
			this._pendingRestorationRequests.push(id);
			this._user.send("/game/restore/" + id +"/pending");
		}
		
		request.then((function(game) {
			this._addGame(game);
			this._user.send("/game/restore/" + id + "/success", game);
		}).bind(this), (function(error) {
			this._user.send("/game/restore/" + id + "/failure", error);
		}).bind(this), (function() {
			this._pendingRestorationRequests.remove(id);
		}).bind(this));
	}
	
	User.prototype._cancelRestoration = function(id) {
		this._app.cancelGameRestoration(this._player, id);
	}
	
	User.prototype._registerCompletedRatedGame = function(game) {
		var colour = game.getPlayerColour(this._player);
		var opponentGlicko2 = game.getPlayer(colour.opposite).getGlicko2();
		var result = game.getResult();
		
		this._recentRatedResults.push({
			opponentGlicko2: {
				rating: opponentGlicko2.rating,
				rd: opponentGlicko2.rd,
				vol: opponentGlicko2.vol
			},
			playerScore: result.scores[colour]
		});
		
		if(this._recentRatedResults.length === glicko2Constants.GAMES_PER_RATING_PERIOD) {
			this._updateGlicko2();
			this._recentRatedResults = [];
		}
	}
	
	User.prototype._updateGlicko2 = function() {
		var glicko2 = new Glicko2({
			rating: glicko2Constants.defaults.RATING,
			rd: glicko2Constants.defaults.RD,
			vol: glicko2Constants.defaults.VOL
		});
		
		var matches = [];
		var glicko2Player = glicko2.makePlayer(this._glicko2.rating, this._glicko2.rd, this._glicko2.vol);
		
		this._recentRatedResults.forEach(function(result) {
			var opponentGlicko2 = result.opponentGlicko2;
			var glicko2Opponent = glicko2.makePlayer(opponentGlicko2.rating, opponentGlicko2.rd, opponentGlicko2.vol);
			
			matches.push([glicko2Player, glicko2Opponent, result.playerScore]);
		});
		
		glicko2.updateRatings(matches);
		
		this._glicko2 = {
			rating: glicko2Player.getRating(),
			rd: glicko2Player.getRd(),
			vol: glicko2Player.getVol()
		};
	}
	
	User.prototype._getInitialGlicko2 = function() {
		return {
			rating: glicko2Constants.defaults.RATING,
			rd: glicko2Constants.defaults.RD,
			vol: glicko2Constants.defaults.VOL
		};
	}
	
	User.prototype.getGamesAsWhiteRatio = function() {
		return Math.max(1, this._gamesPlayedAsWhite) / Math.max(1, this._gamesPlayedAsBlack);
	}
	
	User.prototype._getInitialRegistrationJson = function(username, password) {
		return {
			username: username,
			password: password,
			gamesPlayedAsWhite: 0,
			gamesPlayedAsBlack: 0,
			glicko2: this._getInitialGlicko2(),
			lastSeekOptions: this._lastSeekOptions,
			prefs: this._prefs,
			recentRatedResults: []
		};
	}
	
	User.prototype.getPersistentJson = function(password) {
		var data = {
			username: this._username,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack,
			glicko2: this._glicko2,
			lastSeekOptions: this._lastSeekOptions,
			prefs: this._prefs,
			recentRatedResults: this._recentRatedResults
		};
		
		if(password) {
			data.password = password;
		}
		
		return data;
	}
	
	User.prototype._getPrivateJson = function() {
		return {
			playerId: this._player.getId(),
			username: this._username,
			isLoggedIn: this._isLoggedIn,
			rating: this._glicko2.rating,
			currentSeek: this._currentSeek,
			lastSeekOptions: this._lastSeekOptions,
			prefs: this._prefs
		};
	}
	
	User.prototype._loadJson = function(user) {
		this._username = user.username;
		this._gamesPlayedAsWhite = user.gamesPlayedAsWhite;
		this._gamesPlayedAsBlack = user.gamesPlayedAsBlack;
		this._glicko2 = user.glicko2;
		this._lastSeekOptions = user.lastSeekOptions;
		this._prefs = user.prefs;
		this._recentRatedResults = user.recentRatedResults;
	}
	
	return User;
});
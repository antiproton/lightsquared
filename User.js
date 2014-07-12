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
		
		this._gamesPlayedAsWhite = 0;
		this._gamesPlayedAsBlack = 0;
		
		this._username = ANONYMOUS_USERNAME;
		this._isLoggedIn = false;
		this._player = new Player(this);
		
		this._glicko2 = this._getInitialGlicko2();
		this._recentRatedResults = [];
		
		this._currentGames = [];
		this._currentChallenge = null;
		this._lastChallengeOptions = null;
		
		this._prefs = {
			premove: true,
			alwaysQueen: false,
			pieceStyle: null,
			boardSize: null,
			boardStyle: null
		};
		
		this.Connected = new Event(this);
		this.Disconnected = new Event(this);
		this.LoggedIn = new Event(this);
		this.LoggedOut = new Event(this);
		
		this._app.NewChallenge.addHandler(this, function(challenge) {
			this._user.send("/challenges", [challenge]);
		});
		
		this._user.Disconnected.addHandler(this, function() {
			this._removeInactiveGames();
			this.Disconnected.fire();
		});
		
		this._user.Connected.addHandler(this, function() {
			this.Connected.fire();
		});
		
		this._user.CheckingActivity.addHandler(this, function(activityCheck) {
			if(this._isActive()) {
				activityCheck.registerActivity();
			}
		});
		
		this._user.Deregistering.addHandler(this, function() {
			this._updateDb();
			this._logout();
		});
		
		this._subscribeToUserMessages();
	}
	
	User.prototype.replace = function(user) {
		this._loadJson(user.getPersistentJson());
		this._player = user.getPlayer();
		this._player.setUser(this);
		
		user.getCurrentGames().forEach((function(game) {
			this._addGame(game);
		}).bind(this));
		
		user.logout();
		user.disconnect();
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
					this._cancelCurrentChallenge();
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
			this._cancelCurrentChallenge();
			this._currentGames = [];
			this._username = ANONYMOUS_USERNAME;
			this._player = new Player(this);
			this.LoggedOut.fire();
			this._user.send("/user/logout");
		}
	}
	
	User.prototype.disconnect = function() {
		this._user.disconnect();
	}
	
	User.prototype._register = function(username, password) {
		var error = null;
		
		if(this._isLoggedIn) {
			error = "You must be logged out to register an account";
		}
		
		else if(this._hasGamesInProgress()) {
			error = "You must finish all current games before registering an account";
		}
		
		if(error === null) {
			this._db.findOne({
				username: username
			}, (function(error, existingUser) {
				if(!existingUser) {
					this._username = username;
					
					this._db.save(this.getPersistentJson(password), (function(error) {
						if(!error) {
							this._isLoggedIn = true;
							this._cancelCurrentChallenge();
							
							this._user.send("/user/login/success", this._getPrivateJson());
							this._user.send("/user/register/success");
							
							this.LoggedIn.fire({
								username: username
							});
						}
						
						else {
							this._username = ANONYMOUS_USERNAME;
							
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
	
	User.prototype.isLoggedIn = function() {
		return this._isLoggedIn;
	}
	
	User.prototype._isActive = function() {
		var timeLastActive = this._user.getTimeLastActive();
		var maxIdleTime = this._isLoggedIn ? MAX_IDLE_TIME_LOGGED_IN : MAX_IDLE_TIME_ANONYMOUS;
		
		return (timeLastActive >= time() - maxIdleTime || this._hasGamesInProgress());
	}
	
	User.prototype._subscribeToUserMessages = function() {
		this._user.subscribe("/user/login", (function(data) {
			this._login(data.username, data.password);
		}).bind(this));
		
		this._user.subscribe("/user/logout", (function() {
			this._currentGames.forEach((function(game) {
				game.resign(this._player);
			}).bind(this));
			
			this._updateDb();
			this.logout();
		}).bind(this));
		
		this._user.subscribe("/user/register", (function(data) {
			this._register(data.username, data.password);
		}).bind(this));
		
		this._user.subscribe("/challenge/create", (function(options) {
			this._createChallenge(options);
		}).bind(this));
		
		this._user.subscribe("/challenge/cancel", (function() {
			this._cancelCurrentChallenge();
		}).bind(this));
		
		this._user.subscribe("/request/game", (function(id) {
			var game = this._spectateGame(id);
			
			if(game) {
				this._user.send("/game", game);
			}
			
			else {
				this._user.send("/game/not_found", id);
			}
		}).bind(this));
		
		this._user.subscribe("/challenge/accept", (function(id) {
			this._acceptChallenge(id);
		}).bind(this));
		
		this._user.subscribe("/request/games", (function(data, client) {
			client.send("/games", this._currentGames);
		}).bind(this));
		
		this._user.subscribe("/request/user", (function(data, client) {
			client.send("/user", this._getPrivateJson());
		}).bind(this));
		
		this._user.subscribe("/request/challenges", (function(data, client) {
			client.send("/challenges", this._app.getOpenChallenges());
		}).bind(this));
		
		this._user.subscribe("/user/prefs/update", (function(prefs) {
			for(var pref in this._prefs) {
				if(pref in prefs) {
					this._prefs[pref] = prefs[pref];
				}
			}
		}).bind(this));
		
		this._user.subscribe("/request/time", function(requestId, client) {
			client.send("/time/" + requestId, time());
		});
		
		this._user.subscribe("/game/restore", (function(gameDetails) {
			this._app.submitGameRestorationRequest(this, gameDetails);
		}).bind(this));
		
		this._user.subscribe("/game/restore/cancel", (function(id) {
			this._app.cancelGameRestorationRequest(this, id);
		}).bind(this));
	}
	
	User.prototype._subscribeToGameMessages = function(game) {
		/*
		FIXME need to remove these callbacks on GameOver/Aborted as otherwise the games will
		stay around.
		*/
		
		var id = game.getId();
		
		this._user.subscribe("/game/" + id + "/request/moves", (function(data) {
			var index = data.startingIndex;
			
			game.getHistory().slice(index).forEach((function(move) {
				this._user.send("/game/" + id + "/move", Move.getShortJSON(move, index));
			
				index++;
			}).bind(this));
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/chat", (function(message) {
			if(message.length > 0) {
				game.chat(this._player, message);
			}
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/move", (function(data) {
			var promoteTo = (data.promoteTo ? PieceType.fromSanString(data.promoteTo) : undefined);
			
			game.move(this._player, Square.fromSquareNo(data.from), Square.fromSquareNo(data.to), promoteTo);
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/premove", (function(data) {
			var promoteTo = (data.promoteTo ? PieceType.fromSanString(data.promoteTo) : undefined);
			var from = Square.fromSquareNo(data.from);
			var to = Square.fromSquareNo(data.to);
			
			if(game.getPlayerColour(this._player) === game.getActiveColour()) {
				game.move(this._player, from, to, promoteTo);
			}
			
			else {
				game.premove(this._player, from, to, promoteTo);
			}
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/request/premove", (function() {
			if(game.getPlayerColour(this._player) === game.getActiveColour().opposite) {
				this._user.send("/game/" + id + "/premove", this._pendingPremove);
			}
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/premove/cancel", (function() {
			game.cancelPremove(this._player);
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/resign", (function() {
			game.resign(this._player);
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/offer_draw", (function() {
			game.offerDraw(this._player);
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/claim_draw", (function() {
			game.claimDraw(this._player);
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/accept_draw", (function() {
			game.acceptDraw(this._player);
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/offer_or_accept_rematch", (function() {
			game.offerOrAcceptRematch(this._player);
		}).bind(this));
		
		this._user.subscribe("/game/" + id + "/decline_rematch", (function() {
			game.declineRematch(this._player);
		}).bind(this));
	}
	
	User.prototype._createChallenge = function(options) {
		this._cancelCurrentChallenge();
		
		var challenge = this._app.createChallenge(this._player, options);
		
		challenge.Accepted.addHandler(this, function(game) {
			this._addGame(game);
			this._user.send("/challenge/accepted", game);
		});
		
		challenge.Expired.addHandler(this, function() {
			this._user.send("/current_challenge/expired");
		});
		
		this._user.send("/current_challenge", challenge);
		this._lastChallengeOptions = options;
	}
	
	User.prototype._acceptChallenge = function(id) {
		var challenge = this._app.getChallenge(id);
		
		if(challenge !== null) {
			var game = challenge.accept(this._player);
			
			if(game !== null) {
				this._addGame(game);
				this._user.send("/challenge/accepted", game);
				this._cancelCurrentChallenge();
			}
		}
	}
	
	User.prototype._cancelCurrentChallenge = function() {
		if(this._currentChallenge !== null) {
			this._currentChallenge.cancel();
		}
	}
	
	User.prototype._addGame = function(game) {
		var id = game.getId();
		
		this._currentGames.push(game);
		this._subscribeToGameMessages(game);
		
		game.Move.addHandler(this, function(move) {
			this._user.send("/game/" + id + "/move", Move.getShortJSON(move, game.getHistory().length - 1));
		});
		
		game.Aborted.addHandler(this, (function() {
			this._currentGames.remove(game);
			this._user.send("/game/" + id + "/aborted");
			//FIXME remove callbacks (but not the /rematch ones)
		}));
		
		game.DrawOffered.addHandler(this, function() {
			this._user.send("/game/" + id + "/draw_offer", game.getActiveColour().opposite.fenString);
		});
		
		game.Rematch.addHandler(this, (function(game) {
			this._addGame(game);
			this._user.send("/game/" + id + "/rematch", game);
		}).bind(this));
		
		game.GameOver.addHandler(this, function(result) {
			if(this._isPlayer(game)) {
				this._registerCompletedRatedGame(game);
			}
			
			//FIXME remove callbacks (but not the /rematch ones)
			this._user.send("/game/" + id + "/game_over", result);
		});
		
		game.Chat.addHandler(this, function(data) {
			if(!this._isPlayer(game) || game.playerIsPlaying(data.player)) {
				this._user.send("/game/" + id + "/chat", {
					from: data.player.getName(),
					body: data.message
				});
			}
		});
		
		if(this._isPlayer(game)) {
			game.RematchOffered.addHandler(this, function(player) {
				if(player !== this._player) {
					this._user.send("/game/" + id + "/rematch_offer");
				}
			});
			
			game.RematchDeclined.addHandler(this, function() {
				if(player !== this._player) {
					this._user.send("/game/" + id + "/rematch_declined");
				}
			});
		}
	}
	
	User.prototype._isPlayer = function(game) {
		return game.playerIsPlaying(this._player);
	}
	
	User.prototype._removeInactiveGames = function() {
		//FIXME remove callbacks (including /rematch ones)
		this._currentGames = this._currentGames.filter((function(game) {
			return (game.isInProgress() || time() - game.getEndTime() < INACTIVE_GAMES_EXPIRE);
		}).bind(this));
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
	
	User.prototype._registerCompletedRatedGame = function(game) {
		var colour = game.getPlayerColour(this);
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
	
	User.prototype.toJSON = function() {
		return {
			id: this._id,
			username: this._username,
			isLoggedIn: this._isLoggedIn,
			rating: this._glicko2.rating
		};
	}
	
	User.prototype.getPersistentJson = function(password) {
		var data = {
			username: this._username,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack,
			glicko2: this._glicko2,
			lastChallengeOptions: this._lastChallengeOptions,
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
			id: this._id,
			username: this._username,
			isLoggedIn: this._isLoggedIn,
			rating: this._glicko2.rating,
			currentChallenge: this._currentChallenge,
			lastChallengeOptions: this._lastChallengeOptions,
			prefs: this._prefs
		};
	}
	
	User.prototype._loadJson = function(user) {
		this._username = user.username;
		this._gamesPlayedAsWhite = user.gamesPlayedAsWhite;
		this._gamesPlayedAsBlack = user.gamesPlayedAsBlack;
		this._glicko2 = user.glicko2;
		this._lastChallengeOptions = user.lastChallengeOptions;
		this._prefs = user.prefs;
		this._recentRatedResults = user.recentRatedResults;
	}
	
	return User;
});
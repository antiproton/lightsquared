define(function(require) {
	var Publisher = require("lib/Publisher");
	var id = require("lib/id");
	var time = require("lib/time");
	var Event = require("lib/Event");
	var Glicko = require("chess/Glicko");
	require("lib/Array.getShallowCopy");
	require("lib/Array.contains");
	require("lib/Array.remove");
	
	var ANONYMOUS_USERNAME = "Anonymous";
	var MAX_IDLE_TIME_ANONYMOUS = 1000 * 60 * 60 * 24;
	var MAX_IDLE_TIME_LOGGED_IN = 1000 * 60 * 60 * 24 * 30;
	var INACTIVE_GAMES_EXPIRE = 1000 * 60 * 5;
	
	function User(user, app, db) {
		this._id = id();
		this._db = db;
		this._user = user;
		this._app = app;
		this._username = ANONYMOUS_USERNAME;
		this._isLoggedIn = false;
		this._publisher = new Publisher(this);
		this._gamesPlayedAsWhite = 0;
		this._gamesPlayedAsBlack = 0;
		this._rating = Glicko.INITIAL_RATING;
		this._currentGames = [];
		this._currentChallenge = null;
		this._lastChallengeOptions = null;
		
		this._prefs = {
			alwaysQueen: false,
			pieceStyle: null,
			boardSize: null,
			boardStyle: null
		};
		
		this.Connected = new Event(this);
		this.Disconnected = new Event(this);
		this.LoggedIn = new Event(this);
		this.LoggedOut = new Event(this);
		this.Replaced = new Event(this);
		
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
	
	User.prototype.getCurrentGames = function() {
		return this._currentGames.getShallowCopy();
	}
	
	User.prototype.getRating = function() {
		return this._rating;
	}
	
	User.prototype.getGamesPlayedAsWhite = function() {
		return this._gamesPlayedAsWhite;
	}
	
	User.prototype.getGamesPlayedAsBlack = function() {
		return this._gamesPlayedAsBlack;
	}
	
	User.prototype.updateRating = function(newRating) {
		this._rating = newRating;
	}
	
	User.prototype.replace = function(user) {
		this._loadJson(user.getPersistentJson());
		
		user.replaceWith(this);
		
		user.getCurrentGames().forEach((function(game) {
			this._currentGames.push(game);
		}).bind(this));
	}
	
	User.prototype.replaceWith = function(user) {
		this.Replaced.fire({
			newUser: user
		});
		
		this._logout();
		this._user.send("/user/replaced");
		this._user.disconnect();
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
					
					this.LoggedIn.fire({
						username: username
					});
					
					this._user.send("/user/login/success", this._getPrivateJson());
				}
				
				else {
					this._user.send("/user/login/failure", {
						reason: "Username/password combination not recognised"
					});
				}
			}).bind(this));
		}
		
		else {
			this._user.send("/user/login/failure", {
				reason: error
			});
		}
	}
	
	User.prototype._logout = function() {
		if(this._isLoggedIn) {
			this._isLoggedIn = false;
			this._cancelCurrentChallenge();
			this._username = ANONYMOUS_USERNAME;
			this._rating = Glicko.INITIAL_RATING;
			this.LoggedOut.fire();
			this._user.send("/user/logout");
		}
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
							
							this._user.send("/user/register/failure", {
								reason: "Server error: " + error
							});
						}
					}).bind(this));
				}
				
				else {
					this._user.send("/user/register/failure", {
						reason: "The username '" + username + "' is already registered"
					});
				}
			}).bind(this));
		}
		
		else {
			this._user.send("/user/register/failure", {
				reason: error
			});
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
	
	User.prototype.subscribe = function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe = function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}
	
	User.prototype.send = function(url, data) {
		this._user.send(url, data);
	}
	
	User.prototype.getUsername = function() {
		return this._username;
	}
	
	User.prototype.isLoggedIn = function() {
		return this._isLoggedIn;
	}
	
	User.prototype._isActive = function() {
		var timeLastActive = this._user.getTimeLastActive();
		var maxIdleTime = this._isLoggedIn ? MAX_IDLE_TIME_LOGGED_IN : MAX_IDLE_TIME_ANONYMOUS;
		
		return (timeLastActive >= time() - maxIdleTime || this._hasGamesInProgress());
	}
	
	User.prototype.getGamesAsWhiteRatio = function() {
		return Math.max(1, this._gamesPlayedAsWhite) / Math.max(1, this._gamesPlayedAsBlack);
	}
	
	User.prototype._subscribeToUserMessages = function() {
		this._user.subscribe("*", (function(url, data, client) {
			this._publisher.publish(url, data, client);
		}).bind(this));
		
		this._user.subscribe("/user/login", (function(data) {
			this._login(data.username, data.password);
		}).bind(this));
		
		this._user.subscribe("/user/logout", (function() {
			this._updateDb();
			this._logout();
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
		
		this._user.subscribe("/game/spectate", (function(id) {
			this._spectateGame(id);
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
	}
	
	User.prototype._createChallenge = function(options) {
		this._cancelCurrentChallenge();
		
		var challenge = this._app.createChallenge(this, options);
		
		challenge.Accepted.addHandler(this, function(game) {
			this._addGame(game);
		});
		
		challenge.Expired.addHandler(this, function() {
			this._currentChallenge = null;
			this._user.send("/current_challenge/expired");
		});
		
		this._user.send("/current_challenge", challenge);
		this._currentChallenge = challenge;
		this._lastChallengeOptions = options;
	}
	
	User.prototype._cancelCurrentChallenge = function() {
		if(this._currentChallenge !== null) {
			this._currentChallenge.cancel();
		}
	}
	
	User.prototype._acceptChallenge = function(id) {
		var challenge = this._app.getChallenge(id);
			
		if(challenge !== null) {
			var game = challenge.accept(this);
			
			if(game !== null) {
				this._addGame(game);
				this._cancelCurrentChallenge();
			}
		}
	}
	
	User.prototype._addGame = function(game) {
		this._currentGames.push(game);
		
		game.Aborted.addHandler(this, (function() {
			this._currentGames.remove(game);
		}));
		
		game.Rematch.addHandler(this, (function(game) {
			this._addGame(game);
		}).bind(this));
	}
	
	User.prototype._removeInactiveGames = function() {
		this._currentGames = this._currentGames.filter((function(game) {
			return (game.isInProgress() || time() - game.getEndTime() < INACTIVE_GAMES_EXPIRE);
		}).bind(this));
	}
	
	User.prototype._spectateGame = function(id) {
		var game = this._app.getGame(id);
		
		if(game === null) {
			this._currentGames.some(function(sessionGame) {
				if(sessionGame.getId() === id) {
					game = sessionGame;
					
					return true;
				}
			});
		}
			
		if(game !== null) {
			if(!this._currentGames.contains(game)) {
				game.spectate(this);
			
				this._addGame(game);
			}
			
			this._user.send("/game", game);
		}
	}
	
	User.prototype._hasGamesInProgress = function() {
		return this._currentGames.some((function(game) {
			return game.userIsPlaying(this);
		}).bind(this));
	}
	
	User.prototype.toJSON = function() {
		return {
			id: this._id,
			username: this._username,
			isLoggedIn: this._isLoggedIn,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack,
			rating: this._rating
		};
	}
	
	User.prototype.getPersistentJson = function(password) {
		var data = {
			username: this._username,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack,
			rating: this._rating,
			lastChallengeOptions: this._lastChallengeOptions,
			prefs: this._prefs
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
			rating: this._rating,
			currentChallenge: this._currentChallenge,
			lastChallengeOptions: this._lastChallengeOptions,
			prefs: this._prefs
		};
	}
	
	User.prototype._loadJson = function(user) {
		this._username = user.username;
		this._gamesPlayedAsWhite = user.gamesPlayedAsWhite;
		this._gamesPlayedAsBlack = user.gamesPlayedAsBlack;
		this._rating = user.rating;
		this._lastChallengeOptions = user.lastChallengeOptions;
		this._prefs = user.prefs;
	}
	
	return User;
});
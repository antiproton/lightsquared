define(function(require) {
	var Publisher = require("lib/Publisher");
	require("lib/Array.remove");
	var User = require("./User");
	var Challenge = require("./Challenge");
	var time = require("lib/time");
	var Game = require("./Game");
	
	function Application(server, db) {
		this._users = {};
		this._loggedInUsers = {};
		this._openChallenges = {};
		this._games = {};
		this._promises = {};
		this._publisher = new Publisher();
		this._db = db;
		this._pendingGameRestorations = {};
		
		server.UserConnected.addHandler(this, function(serverUser) {
			var user = new User(serverUser, this, this._db.collection("users"));
			
			this._setupUser(user);
			this._replaceExistingLoggedInUser(user);
			this._users[user.getId()] = user;
			
			if(user.isLoggedIn()) {
				this._loggedInUsers[user.getUsername()] = user;
			}
		});
	}
	
	Application.prototype.createChallenge = function(owner, options) {
		var challenge = new Challenge(owner, options);
		var id = challenge.getId();
		
		challenge.Accepted.addHandler(this, function(game) {
			this._addGame(game);
			
			delete this._openChallenges[id];
			
			return true;
		});
		
		challenge.Expired.addHandler(this, function() {
			this._sendToAllUsers("/challenge/expired", id);
			
			delete this._openChallenges[id];
		});
		
		this._openChallenges[id] = challenge;
		this._sendToAllUsers("/challenges", [challenge]);
		
		return challenge;
	}
	
	Application.prototype._addGame = function(game) {
		var gameId = game.getId();
		
		this._games[gameId] = game;
		
		game.GameOver.addHandler(this, function() {
			this._db.collection("games").insert(JSON.parse(JSON.stringify(game)), function() {});
			
			delete this._games[gameId];
		});
		
		game.Aborted.addHandler(this, function() {
			delete this._games[gameId];
		});
		
		game.Rematch.addHandler(this, function(game) {
			this._addGame(game);
		});
	}
	
	Application.prototype.getChallenge = function(id) {
		return this._openChallenges[id] || null;
	}
	
	Application.prototype.getGame = function(id) {
		return this._games[id] || null;
	}
	
	Application.prototype.getArchivedGameDetails = function(id) {
		var promiseId = "/game/" + id;
		
		if(promiseId in this._promises) {
			return this._promises[promiseId];
		}
		
		else {
			var promise = new Promise();
			
			promise.then(null, null, (function() {
				delete this._promises[promiseId];
			}).bind(this));
			
			if(id in this._games) {
				promise.resolve(JSON.parse(JSON.stringify(this._games[id])));
			}
			
			else {
				this._db.collection("games").findOne({
					id: id
				}, (function(error, gameDetails) {
					if(error) {
						promise.fail(error);
					}
					
					else {
						promise.resolve(gameDetails);
					}
				}).bind(this));
			}
			
			this._promises[promiseId] = promise;
			
			return promise;
		}
	}
	
	Application.prototype._replaceExistingLoggedInUser = function(user) {
		var username = user.getUsername();
		
		if(user.isLoggedIn() && username in this._loggedInUsers && this._loggedInUsers[username] !== user) {
			user.replace(this._loggedInUsers[username]);
		}
	}
	
	Application.prototype._setupUser = function(user) {
		var loggedInUsername;
		
		user.Disconnected.addHandler(this, function() {
			delete this._users[user.getId()];
		});
		
		user.Connected.addHandler(this, function() {
			this._users[user.getId()] = user;
		});
		
		user.LoggedIn.addHandler(this, function() {
			loggedInUsername = user.getUsername();
			
			this._replaceExistingLoggedInUser(user);
			this._loggedInUsers[loggedInUsername] = user;
		});
		
		user.LoggedOut.addHandler(this, function() {
			delete this._loggedInUsers[loggedInUsername];
		});
		
		user.Replaced.addHandler(this, function(newUser) {
			this._loggedInUsers[loggedInUsername] = newUser;
		});
		
		user.subscribe("/request/time", function(requestId, client) {
			client.send("/time/" + requestId, time());
		});
		
		user.subscribe("/game/restore", (function(gameDetails) {
			this._submitGameRestorationRequest(user, gameDetails);
		}).bind(this));
		
		user.subscribe("/game/restore/cancel", (function(id) {
			this._cancelGameRestorationRequest(user, id);
		}).bind(this));
	}
	
	Application.prototype._submitGameRestorationRequest = function(user, gameDetails) {
		var id = gameDetails.id;
		var error = null;
		
		if(id in this._games) {
			error = "The specified game is active on the server";
		}
		
		if(!error) {
			if(id in this._pendingGameRestorations) {
				var pendingRestoration = this._pendingGameRestorations[id];
				
				if(pendingRestoration.user !== user) {
					var users = [user, pendingRestoration.user];
					
					try {
						var game = Game.restore({
							user: user,
							gameDetails: gameDetails
						}, pendingRestoration);
						
						users.forEach((function(user) {
							user.send("/game/restore/success", game);
						}).bind(this));
					}
					
					catch(restorationError) {
						users.forEach((function(user) {
							user.send("/game/restore/failure", {
								id: id,
								reason: restorationError
							});
						}).bind(this));
					}
						
					delete this._pendingGameRestorations[id];
				}
			}
			
			else {
				this._pendingGameRestorations[id] = {
					user: user,
					gameDetails: gameDetails
				};
				
				user.send("/game/restore/pending", id);
			}
		}
		
		if(error) {
			user.send("/game/restore/failure", {
				id: id,
				reason: error
			});
		}
	}
	
	Application.prototype._cancelGameRestorationRequest = function(user, id) {
		if(id in this._pendingGameRestorations && this._pendingGameRestorations[id].user === user) {
			delete this._pendingGameRestorations[id];
			
			user.send("/game/restore/canceled", id);
		}
	}
	
	Application.prototype.getOpenChallenges = function() {
		var openChallenges = [];
		
		for(var id in this._openChallenges) {
			openChallenges.push(this._openChallenges[id]);
		}
		
		return openChallenges;
	}
	
	Application.prototype._sendToAllUsers = function(url, data) {
		for(var id in this._users) {
			this._users[id].send(url, data);
		}
	}
	
	return Application;
});
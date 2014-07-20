define(function(require) {
	var Publisher = require("lib/Publisher");
	require("lib/Array.remove");
	var User = require("./User");
	var Challenge = require("./Challenge");
	var time = require("lib/time");
	var Game = require("./Game");
	var Event = require("lib/Event");
	var Promisor = require("lib/Promisor");
	var RandomGames = require("./RandomGames");
	
	function Application(server, db) {
		this._users = {};
		this._loggedInUsers = {};
		this._openChallenges = {};
		this._games = {};
		this._promisor = new Promisor(this);
		this._publisher = new Publisher();
		this._db = db;
		this._pendingGameRestorations = {};
		
		this.NewGame = new Event(this);
		this.NewChallenge = new Event(this);
		this.ChallengeExpired = new Event(this);
		
		server.UserConnected.addHandler(this, function(serverUser) {
			var user = new User(serverUser, this, this._db.collection("users"));
			
			this._setupUser(user);
			this._replaceExistingLoggedInUser(user);
			this._users[user.getId()] = user;
			
			if(user.isLoggedIn()) {
				this._loggedInUsers[user.getUsername()] = user;
			}
		});
		
		this._randomGames = new RandomGames(this);
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
			this.ChallengeExpired.fire(id);
			
			delete this._openChallenges[id];
		});
		
		this._openChallenges[id] = challenge;
		
		this.NewChallenge.fire(challenge);
		
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
		
		this.NewGame.fire(game);
	}
	
	Application.prototype.getRandomGames = function() {
		return this._randomGames;
	}
	
	Application.prototype.getChallenge = function(id) {
		return this._openChallenges[id] || null;
	}
	
	Application.prototype.getGame = function(id) {
		return this._games[id] || null;
	}
	
	Application.prototype.getArchivedGameDetails = function(id) {
		return this._promisor.get("/game/" + id, function(promise) {
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
		});
	}
	
	Application.prototype._replaceExistingLoggedInUser = function(user) {
		var username = user.getUsername();
		
		if(username in this._loggedInUsers && this._loggedInUsers[username] !== user) {
			user.replace(this._loggedInUsers[username]);
			
			this._loggedInUsers[username] = user;
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
	}
	
	Application.prototype.restoreGame = function(player, request) {
		var id = request.gameDetails.id;
		var promise = this._promisor.get("/game/restore/" + id);
		
		if(id in this._games) {
			promise.fail("The specified game is active on the server");
		}
		
		else {
			if(id in this._pendingGameRestorations) {
				var pendingRestoration = this._pendingGameRestorations[id];
				
				if(pendingRestoration.player !== player) {
					try {
						var game = Game.restore({
							player: player,
							gameDetails: request.gameDetails,
							colour: request.playingAs
						}, pendingRestoration);
						
						promise.resolve(game);
					}
					
					catch(restorationError) {
						promise.fail(restorationError);
					}
						
					delete this._pendingGameRestorations[id];
				}
			}
			
			else {
				this._pendingGameRestorations[id] = {
					player: player,
					gameDetails: request.gameDetails,
					colour: request.playingAs
				};
			}
		}
		
		return promise;
	}
	
	Application.prototype.cancelGameRestoration = function(player, id) {
		if(id in this._pendingGameRestorations && this._pendingGameRestorations[id].player === player) {
			this._promisor.fail("/game/restore/" + id, "Request canceled");
			
			delete this._pendingGameRestorations[id];
			
			return true;
		}
		
		else {
			return false;
		}
	}
	
	Application.prototype.getOpenChallenges = function() {
		var openChallenges = [];
		
		for(var id in this._openChallenges) {
			openChallenges.push(this._openChallenges[id]);
		}
		
		return openChallenges;
	}
	
	Application.prototype.getCurrentGames = function() {
		var games = [];
		
		for(var id in this._games) {
			games.push(this._games[id]);
		}
		
		return games;
	}
	
	return Application;
});
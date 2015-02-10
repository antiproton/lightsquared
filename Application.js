define(function(require) {
	require("Array.prototype/remove");
	var time = require("js/time");
	var Event = require("js/Event");
	var objToArray = require("js/objToArray");
	var Promisor = require("js/Promisor");
	var User = require("./User");
	var Seek = require("./Seek");
	var Game = require("./Game");
	var Tournament = require("./Tournament");
	var RandomGames = require("./RandomGames");
	var jsonchessMessageTypes = require("jsonchess/chatMessageTypes");
	
	function Application(server, db) {
		this._users = {};
		this._loggedInUsers = {};
		this._openSeeks = {};
		this._games = {};
		this._activeTournaments = {};
		this._promisor = new Promisor(this);
		this._db = db;
		this._pendingGameRestorations = {};
		
		this.NewGame = new Event();
		this.NewSeek = new Event();
		this.SeekExpired = new Event();
		this.Chat = new Event();
		this.UserConnected = new Event();
		this.UserDisconnected = new Event();
		this.NewTournament = new Event();
		this.TournamentFinished = new Event();
		
		server.UserConnected.addHandler(function(serverUser) {
			var user = new User(serverUser, this, this._db.collection("users"));
			
			this._setupUser(user);
			this._replaceExistingLoggedInUser(user);
			this._users[user.getId()] = user;
			this.UserConnected.fire(user);
			
			if(user.isLoggedIn()) {
				this._loggedInUsers[user.getUsername()] = user;
			}
		}, this);
		
		this._randomGames = new RandomGames(this, 10);
	}
	
	Application.prototype.chat = function(player, message) {
		this.Chat.fire({
			from: player,
			body: message,
			type: jsonchessMessageTypes.USER
		});
	}
	
	Application.prototype.createSeek = function(player, options) {
		var seek = new Seek(player, options);
		var id = seek.getId();
		
		seek.Matched.addHandler(function(game) {
			this._addGame(game);
			this.SeekExpired.fire(id);
			
			delete this._openSeeks[id];
		}, this);
		
		seek.Expired.addHandler(function() {
			this.SeekExpired.fire(id);
			
			delete this._openSeeks[id];
		}, this);
		
		this._openSeeks[id] = seek;
		
		this.NewSeek.fire(seek);
		
		return seek;
	}
	
	Application.prototype._addGame = function(game) {
		var gameId = game.getId();
		
		this._games[gameId] = game;
		
		game.GameOver.addHandler(function() {
			this._db.collection("games").insert(JSON.parse(JSON.stringify(game)), function() {});
			
			delete this._games[gameId];
		}, this);
		
		game.Aborted.addHandler(function() {
			delete this._games[gameId];
		}, this);
		
		game.Rematch.addHandler(function(game) {
			this._addGame(game);
		}, this);
		
		this.NewGame.fire(game);
	}
	
	Application.prototype.getRandomGames = function() {
		return this._randomGames;
	}
	
	Application.prototype.getSeek = function(id) {
		return this._openSeeks[id] || null;
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
	
	Application.prototype.createTournament = function(organiser, options) {
		var tournament = new Tournament(organiser, options);
		
		tournament.Canceled.addHandler(function() {
			this._removeTournament(tournament);
		}, this);
		
		tournament.Finished.addHandler(function() {
			this._removeTournament(tournament);
			this._archiveTournament(tournament);
		}, this);
		
		this._activeTournaments[tournament.id] = tournament;
		this.NewTournament.fire(tournament);
		
		return tournament;
	}
	
	Application.prototype._removeTournament = function(tournament) {
		delete this._activeTournaments[tournament.id];
		
		this.TournamentExpired.fire(tournament.id);
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
		
		user.Disconnected.addHandler(function() {
			delete this._users[user.getId()];
			this.UserDisconnected.fire(user);
		}, this);
		
		user.Connected.addHandler(function() {
			this._users[user.getId()] = user;
			this.UserConnected.fire(user);
		}, this);
		
		user.LoggedIn.addHandler(function() {
			loggedInUsername = user.getUsername();
			
			this._replaceExistingLoggedInUser(user);
			this._loggedInUsers[loggedInUsername] = user;
		}, this);
		
		user.LoggedOut.addHandler(function() {
			delete this._loggedInUsers[loggedInUsername];
		}, this);
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
	
	Application.prototype.getActiveTournaments = function() {
		return objToArray(this._activeTournaments);
	}
	
	Application.prototype.getOpenSeeks = function() {
		return objToArray(this._openSeeks);
	}
	
	Application.prototype.getOnlineUsers = function() {
		return objToArray(this._users);
	}
	
	Application.prototype.getCurrentGames = function() {
		return objToArray(this._games);
	}
	
	return Application;
});
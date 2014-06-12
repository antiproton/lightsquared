define(function(require) {
	var Publisher = require("lib/Publisher");
	require("lib/Array.remove");
	var User = require("./User");
	var Challenge = require("./Challenge");
	var time = require("lib/time");
	
	function Application(server, db) {
		this._users = {};
		this._loggedInUsers = {};
		this._openChallenges = {};
		this._games = {};
		this._publisher = new Publisher();
		this._db = db;
		
		server.UserConnected.addHandler(this, function(data) {
			var user = new User(data.user, this, this._db.collection("users"));
			
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
		
		user.LoggedIn.addHandler(this, function(data) {
			loggedInUsername = user.getUsername();
			
			this._replaceExistingLoggedInUser(user);
			this._loggedInUsers[loggedInUsername] = user;
		});
		
		user.LoggedOut.addHandler(this, function() {
			delete this._loggedInUsers[loggedInUsername];
		});
		
		user.Replaced.addHandler(this, function(data) {
			this._loggedInUsers[user.getUsername()] = data.newUser;
		});
		
		user.subscribe("/request/time", function(data, client) {
			client.send("/time", time());
		});
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
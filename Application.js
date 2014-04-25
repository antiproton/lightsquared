define(function(require) {
	var Publisher = require("lib/Publisher");
	require("lib/Array.remove");
	var User = require("./User");
	var Challenge = require("./Challenge");
	
	function Application(server) {
		this._users = {};
		this._loggedInUsers = {};
		this._openChallenges = {};
		this._games = {};
		this._publisher = new Publisher();
		
		server.UserConnected.addHandler(this, function(data) {
			var user = new User(data.user, this);
			
			this._handleUserEvents(user);
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
		
		challenge.Accepted.addHandler(this, function(data) {
			var game = data.game;
			
			this._games[game.getId()] = game;
			this._sendToAllUsers("/challenge/expired", id);
			
			delete this._openChallenges[id];
			
			return true;
		});
		
		this._openChallenges[id] = challenge;
		this._sendToAllUsers("/challenges", [challenge]);
		
		return challenge;
	}
	
	Application.prototype.acceptChallenge = function(user, id) {
		if(id in this._openChallenges) {
			this._openChallenges[id].accept(user);
		}
	}
	
	Application.prototype.getGame = function(id) {
		if(id in this._games) {
			return this._games[id];
		}
		
		else {
			return null;
		}
	}
	
	Application.prototype._replaceExistingLoggedInUser = function(user) {
		var username = user.getUsername();
		
		if(user.isLoggedIn() && username in this._loggedInUsers && this._loggedInUsers[username] !== user) {
			user.replace(this._loggedInUsers[username]);
		}
	}
	
	Application.prototype._handleUserEvents = function(user) {
		user.Disconnected.addHandler(this, function() {
			delete this._users[user.getId()];
		});
		
		user.Connected.addHandler(this, function() {
			this._users[user.getId()] = user;
			this._replaceExistingLoggedInUser(user);
			
			if(user.isLoggedIn()) {
				this._loggedInUsers[user.getUsername()] = user;
			}
		});
		
		user.LoggedIn.addHandler(this, function(data) {
			this._replaceExistingLoggedInUser(user);
			this._loggedInUsers[user.getUsername()] = user;
		});
		
		user.Replaced.addHandler(this, function(data) {
			this._loggedInUsers[user.getUsername()] = data.newUser;
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
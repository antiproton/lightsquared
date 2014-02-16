define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.remove");
	var User=require("./User");
	var Challenge=require("./Challenge");
	
	function Application(server) {
		this._users={};
		this._openChallenges={};
		this._publisher=new Publisher();
		
		server.UserConnected.addHandler(this, function(data) {
			var user=new User(data.user);
			
			user.Disconnected.addHandler(this, function() {
				this._disconnectUser(user);
			});
			
			user.Connected.addHandler(this, function() {
				this._connectUser(user);
			});
			
			this._connectUser(user);
			
			user.subscribe("/challenge/create", (function(options) {
				this._createChallenge(user, options);
			}).bind(this));
			
			user.subscribe("/challenge/accept", (function(id) {
				this._acceptChallenge(user, id);
			}).bind(this));
		});
	}
	
	Application.prototype._connectUser=function(user) {
		this._users[chessUser]=user;
			
		user.sendCurrentTables(this._tables);
		user.send("/challenge/list", this._openChallenges);
		
		this._sendToAllUsers("/user/connected", user);
	}
	
	Application.prototype._disconnectUser=function(user) {
		this._sendToAllUsers("/user/disconnected", user.getId());
		
		delete this._users[user];
	}
	
	Application.prototype._createChallenge=function(owner, options) {
		var challenge=new Challenge(owner, options);
		
		this._openChallenges[challenge]=challenge;
		this._sendToAllUsers("/challenge/new", challenge);
	}
	
	Application.prototype._acceptChallenge=function(user, id) {
		if(id in this._openChallenges && this._openChallenges[id].accept(user)) {
			this._sendToAllUsers("/challenge/expired", id);
			
			delete this._openChallenges[id];
		}
	}
	
	Application.prototype._sendToAllUsers=function(url, data) {
		for(var id in this._users) {
			this._users[id].send(url, data);
		}
	}
	
	return Application;
});
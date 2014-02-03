define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.remove");
	var User=require("./User");
	
	function Application(server) {
		this._server=server;
		this._tables=[];
		this._users=[];
		this._openChallenges=[];
		this._publisher=new Publisher();
		
		server.ClientConnected.addHandler(this, function(data) {
			var client=data.client;
			var user=new User(client);
			
			this._users.push(user);
			
			user.subscribe("/disconnected", (function() {
				this._sendToAllUsers("/user/disconnected", user.getId());
				this._users.remove(user);
			}).bind(this));
			
			user.subscribe("/create_challenge", (function(data) {
				this._createChallenge(user, data);
			}).bind(this));
			
			user.sendCurrentTables(this._tables);
			user.send("/challenges", this._openChallenges);
			this._sendToAllUsers("/user/connected", user.getId());
		});
	}
	
	Application.prototype._createChallenge=function(owner, options) {
		var challenge=new Challenge(owner, options);
		
		this._openChallenges[challenge.getId()]=challenge;
		this._sendToAllUsers("/challenges", [challenge]);
	}
	
	Application.prototype._sendToAllUsers=function(url, data) {
		this._users.forEach(function(user) {
			user.send(url, data);
		});
	}
	
	return Application;
});
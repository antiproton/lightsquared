define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.remove");
	var User=require("./User");
	
	function Application(server) {
		this._server=server;
		this._tables=[];
		this._openChallenges=[];
		this._publisher=new Publisher();
		
		server.ClientConnected.addHandler(this, function(data) {
			var client=data.client;
			var user=new User(client);
			
			user.subscribe("/disconnected", (function() {
				this._sendBroadcastMessage({
					"/user_disconnected": user.id
				});
			}).bind(this));
			
			user.send({
				"/challenges": this._openChallenges
			});
			
			/*
			TODO send them full data of all the games they're in.
			
			TODO go through games seeing which ones they're in, add them to their list
			when they join/watch a game, add that one.  the above TODO can now be done
			without looping through the games each time.
			*/
			
			this._tables.forEach((function(table) {
				
			}).bind(this));
			
			this._sendBroadcastMessage({
				"/user_connected": user.id
			});
		});
	}
	
	Application.prototype._sendBroadcastMessage=function(dataByUrl) {
		this._server.sendBroadcastMessage(dataByUrl);
	}
	
	return Application;
});
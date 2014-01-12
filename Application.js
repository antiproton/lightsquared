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
			
			client.Disconnected.addHandler(this, function() {
				this._sendBroadcastMessage({
					"/user_disconnected": user.id
				});
			});
			
			if(!("user" in client.session)) {
				client.session["user"]=new User(client);
			}
			
			var user=client.session["user"];
			
			user.send({
				"/challenges": this._openChallenges
			});
			
			/*
			TODO send them full data of all the games they're in.
			
			TODO go through games seeing which ones they're in, add them to their list
			when they join/watch a game, add that one.  the above TODO can now be done
			without looping through the games each time.
			*/
			
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
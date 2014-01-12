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
				"/users_online": this._countUsersOnline()
			});
			
			/*
			TODO send them full data of all the games they're in.
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
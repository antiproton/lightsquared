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
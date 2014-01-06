define(function(require) {
	function Application(server) {
		this._onlineUsersByUsername={};
		this._tables=new List();
		this._openChallenges=new List();
		
		server.ClientConnected.addHandler(this, function(data) {
			var client=data.client;
			
			//FIXME attach a user to the client somehow
			
			client.MessageSent.addHandler(this, function() {
				
			});
			
			client.Disconnected.addHandler(this, function() {
				
			});
		});
	}
	
	return Application;
});
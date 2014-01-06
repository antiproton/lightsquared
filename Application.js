define(function(require) {
	var Publisher=require("lib/Publisher");
	var List=require("lib/List");
	
	function Application(server) {
		this._onlineUsersByUsername={};
		this._tables=new List();
		this._openChallenges=new List();
		this._publisher=new Publisher();
		
		server.ClientConnected.addHandler(this, function(data) {
			var client=data.client;
			
			if(client.getUser()===null) {
				client.setUser(new User());
			}
			
			client.subscribe("/disconnect", (function() {
				
			}).bind(this));
		});
	}
	
	return Application;
});
define(function(require) {
	var Publisher=require("lib/Publisher");
	var List=require("lib/List");
	var User=require("./User");
	
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
			
			console.log("connect");
			
			client.subscribe("/disconnect", (function() {
				console.log("disconnect");
			}).bind(this));
			
			client.subscribe("/test", (function(data) {
				console.log(data);
			}).bind(this));
		});
	}
	
	return Application;
});
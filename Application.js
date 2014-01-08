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
			
			if(!("user" in client.session)) {
				client.session["user"]=new User();
			}
		});
	}
	
	return Application;
});
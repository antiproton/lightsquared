define(function(require) {
	var Server=require("./Server");
	var Application=require("./Application");
	
	return {
		run: function() {
			var server=new Server();
			var app=new Application(server);
			
			server.run();
		}
	};
});
define(function(require) {
	var Event=require("lib/Event");
	var WsServer=require("websocket").server;
	var http=require("http");
	var Client=require("./Client");

	function Server(port) {
		this._port=port||Server.DEFAULT_PORT;
		
		this.ClientConnected=new Event(this);
		
		this._clientsBySessionCookie={};
	}

	Server.DEFAULT_PORT=8080;

	Server.prototype.run=function() {
		var httpServer=http.createServer(function(request, response) {
			response.writeHead(404);
			response.end();
		});

		httpServer.listen(this._port);

		wsServer=new WsServer({
			httpServer: httpServer
		});

		wsServer.on("request", (function(request) {
			var cookies={};

			for(var i=0; i<request.cookies.length; i++) {
				cookies[request.cookies[i].name]=request.cookies[i].value;
			}
	
			if("session" in cookies) {
				var sessionId=cookies["session"];
				var connection=request.accept(null, request.origin);
	
				if(!(sessionId in this._clientsBySessionCookie)) {
					this._clientsBySessionCookie[sessionId]=new Client();
				}
				
				var client=this._clientsBySessionCookie[sessionId];
				
				client.disconnect();
				client.connect(connection);
	
				this.ClientConnected.fire({
					client: client
				});
			}
		}).bind(this));
	}

	return Server;
});
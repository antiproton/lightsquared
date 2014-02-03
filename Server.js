define(function(require) {
	var Event=require("lib/Event");
	var WsServer=require("websocket").server;
	var http=require("http");
	var Client=require("./Client");
	var time=require("lib/time");
	require("lib/Array.remove");

	function Server(port) {
		this._port=port||Server.DEFAULT_PORT;
		
		this.ClientConnected=new Event(this);
		
		this._session={};
		this._connectedClients=[];
	}

	Server.DEFAULT_PORT=8080;

	Server.prototype.run=function() {
		var httpServer=http.createServer(function(request, response) {
			response.writeHead(404);
			response.end();
		});

		httpServer.listen(this._port);

		var wsServer=new WsServer({
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
	
				if(!(sessionId in this._session)) {
					this._session[sessionId]={};
				}
				
				var client=new Client(connection, this._session[sessionId])
				
				this._connectedClients.push(client);
				
				client.Disconnected.addHandler(this, function() {
					this._connectedClients.remove(client);
				});
	
				this.ClientConnected.fire({
					client: client
				});
			}
		}).bind(this));
	}
	
	Server.prototype.sendBroadcastMessage=function(url, data) {
		this._connectedClients.forEach(function(client) {
			client.send(url, data);
		});
	}

	return Server;
});
define(function(require) {
	var Event=require("lib/Event");
	var WsServer=require("websocket").server;
	var http=require("http");
	var ServerStackLayer=require("./ServerStackLayer");

	function log(message) {
		console.log(message);
	}

	function Server(port) {
		ServerStackLayer.call(this);

		this._port=port||Server.DEFAULT_PORT;
	}

	Server.DEFAULT_PORT=8080;

	/*
	var cookies={};

		for(var i=0; i<request.cookies.length; i++) {
			cookies[request.cookies[i].name]=request.cookies[i].value;
		}

		if("session" in cookies) {
			var sessionId=cookies["session"];
			var connection=request.accept(null, request.origin);

			if(!(sessionId in usersBySessionId)) {
				usersBySessionId[sessionId]=new User();
			}

			var user=usersBySessionId[sessionId];
		}
	*/

	Server.prototype.run=function() {
		var httpServer=http.createServer(function(request, response) {
			response.writeHead(404);
			response.end();
		});

		httpServer.listen(this._port);

		wsServer=new WsServer({
			httpServer: httpServer
		});

		wsServer.on("request", function(request) {
			var connection=request.accept(null, request.origin);
			var client=new Client(connection);

			this.ClientConnected.fire({
				client: client,
				request: request
			});

			connection.on("message", function(message) {
				self._receiveMessage(client, message);
			});

			connection.on("close", function(reason, description) {
				self._clientClosed(client, reason, description);
			});
		});
	}

	Server.prototype._receiveMessage=function(client, message) {
		if(message.type==="utf8") {
			this.MessageReceived.fire({
				client: client,
				message: JSON.parse(message.utf8Data)
			});
		}
	}

	Server.prototype._clientClosed=function(client, reason, description) {
		this.ClientDisconnected.fire({
			client: client,
			reason: reason,
			description: description
		});
	}

	return Server;
});
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
		
		this._timeBetweenKeepAlives=1000;
		this._timeLastBroadcastMessageSent=0;
		this._connectedClients=[];
		
		setInterval((function() {
			this._sendKeepAliveMessages();
		}).bind(this), this._timeBetweenKeepAlives);
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
	
	Server.prototype.sendBroadcastMessage=function(dataByUrl) {
		this._connectedClients.forEach((function(client) {
			client.send(dataByUrl);
		}).bind(this));
		
		this._timeLastBroadcastMessageSent=time();
	}
	
	Server.prototype._sendKeepAliveMessages=function() {
		if(time()-this._timeLastBroadcastMessageSent>this._timeBetweenKeepAlives) {
			this._connectedClients.forEach((function(client) {
				client.sendKeepAliveMessage(this._timeBetweenKeepAlives);
			}).bind(this));
		}
	}

	return Server;
});
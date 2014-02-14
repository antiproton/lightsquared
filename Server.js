define(function(require) {
	var Event=require("lib/Event");
	var WsServer=require("websocket").server;
	var http=require("http");
	var Client=require("./Client");
	var User=require("./User");
	var time=require("lib/time");
	require("lib/Array.remove");
	
	function parseCookies(array) {
		var cookies={};
		
		array.forEach(function(cookie) {
			cookies[cookie.name]=cookie.value;
		});
		
		return cookies;
	}

	function Server(port) {
		this._port=port||Server.DEFAULT_PORT;
		
		this.UserConnected=new Event(this);
		
		this._users={};
		
		this._timeBetweenKeepAlives=1000;
		this._timeLastBroadcastMessageSent=0;
		
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

		var wsServer=new WsServer({
			httpServer: httpServer
		});

		wsServer.on("request", (function(request) {
			var cookies=parseCookies(request.cookies);
	
			if("session" in cookies) {
				var id=cookies["session"];
				var connection=request.accept(null, request.origin);
				var client=new Client(connection);
	
				if(id in this._users) {
					this._users[id].addClient(client);
				}
				
				else {
					this._users[id]=new User(client);
					
					this.UserConnected.fire({
						user: this._users[id]
					});
				}
			}
		}).bind(this));
	}
	
	Server.prototype.sendBroadcastMessage=function(url, data) {
		for(var id in this._users) {
			this._users[id].send(url, data);
		}
		
		this._timeLastBroadcastMessageSent=time();
	}
	
	Server.prototype._sendKeepAliveMessages=function() {
		if(time()-this._timeLastBroadcastMessageSent>this._timeBetweenKeepAlives) {
			this._connectedUsers.forEach((function(user) {
				user.sendKeepAliveMessage(this._timeBetweenKeepAlives);
			}).bind(this));
		}
	}

	return Server;
});
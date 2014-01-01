define(function(require) {
	var ChessApp=require("./ChessApp");

	var ChessServer={
		run: function() {
			var WsServer=require("websocket").server;
			var http=require("http");

			function log(message) {
				console.log(message);
			}

			var httpServer=http.createServer(function(request, response) {
				console.log("rest");
				response.writeHead(404);
				response.end();
			});

			httpServer.listen(8080, function() {
				log((new Date())+" Server is listening on port 8080");
			});

			wsServer=new WsServer({
				httpServer: httpServer
			});

			var usersBySessionId={};

			wsServer.on("request", function(request) {
				var cookies={};

				for(var i=0; i<request.cookies.length; i++) {
					cookies[request.cookies[i].name]=request.cookies[i].value;
				}

				if("session" in cookies) {
					log((new Date())+" Connection accepted "+cookies["session"]);

					var sessionId=cookies["session"];
					var connection=request.accept(null, request.origin);

					if(!(sessionId in usersBySessionId)) {
						usersBySessionId[sessionId]=new User();
					}

					var user=usersBySessionId[sessionId];

					connection.on("message", function(message) {
						if(message.type==="utf8") {
							console.log(JSON.parse(message.utf8Data));
							connection.sendUTF(JSON.stringify({"hi":123}));
						}
					});

					connection.on("close", function(reasonCode, description) {
						delete usersBySessionId[sessionId];

						log((new Date())+" Peer "+connection.remoteAddress+" disconnected.");
					});
				}
			});
		}
	};

	return ChessServer;
});

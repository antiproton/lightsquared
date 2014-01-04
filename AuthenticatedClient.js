define(function(require) {
	var usersBySessionId={};

	function AuthenticatedClient(client, request) {
		this._client=client;

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
	}

	AuthenticatedClient.prototype.sendMessage=function(message) {
		this._client.sendMessage(message);
	}

	AuthenticatedClient.prototype.disconnect=function() {
		this._client.disconnect();
	}

	return AuthenticatedClient;
});
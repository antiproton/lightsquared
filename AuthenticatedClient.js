define(function(require) {
	var usersBySessionId={};

	function AuthenticatedClient(client, session) {
		this._client=client;

		
	}

	AuthenticatedClient.prototype.sendMessage=function(message) {
		this._client.sendMessage(message);
	}

	AuthenticatedClient.prototype.disconnect=function() {
		this._client.disconnect();
	}

	return AuthenticatedClient;
});
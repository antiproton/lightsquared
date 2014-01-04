define(function(require) {
	var ServerStackLayer=require("./ServerStackLayer");

	function AuthenticationLayer(previousLayer) {
		ServerStackLayer.call(this);

		this._previousLayer=previousLayer;

		this._previousLayer.ClientConnected.addHandler(this, function(data) {
			this.ClientConnected.fire({
				client: new AuthenticatedClient(data.client, data.request),
				request: data.request
			});
		});

		this._previousLayer.ClientDisconnected.addHandler(this, function(data) {
			this.ClientDisconnected.fire(data);
		});

		this._previousLayer.MessageReceived.addHandler(this, function(data) {
			this.MessageReceived.fire(data);
		});
	}

	return AuthenticationLayer;
});
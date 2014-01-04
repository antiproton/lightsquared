define(function(require) {
	function ServerStackLayer(previousLayer) {
		this._previousLayer=previousLayer||null;

		this.MessageReceived=new Event(this);
		this.ClientConnected=new Event(this);
		this.ClientDisconnected=new Event(this);
	}

	return ServerStackLayer;
});
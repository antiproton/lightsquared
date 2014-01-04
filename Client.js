define(function(require) {
	function Client(connection) {
		this._connection=connection;
	}

	Client.prototype.sendMessage=function(data) {
		this._connection.sendUTF(JSON.stringify(data));
	}

	Client.prototype.disconnect=function() {
		this._connection.close();
	}

	return Client;
});
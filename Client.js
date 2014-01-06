define(function(require) {
	var Event=require("lib/Event");
	var time=require("lib/time");
	var Publisher=require("lib/Publisher");
	
	function Client(connection, session) {
		this._connection=connection;
		this.session=session;
		this._timeLastMessageReceived=null;
		this._timeLastMessageSent=null;
		this._timeConnected=time();
		this._publisher=new Publisher();
		this._setupConnection();
	}
	
	Client.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	Client.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}

	Client.prototype.sendMessage=function(data) {
		this._connection.sendUTF(JSON.stringify(data));
		this._timeLastMessageReceived=time();
	}
	
	Client.prototype.getTimeLastActive=function() {
		return Math.max(this._timeConnected, this._timeLastMessageSent);
	}
	
	Client.prototype._setupConnection=function() {
		this._connection.on("message", (function(message) {
			if(message.type==="utf8") {
				this._publisher.publish(JSON.parse(message.utf8Data));
				this._timeLastMessageSent=time();
			}
		}).bind(this));

		this._connection.on("close", (function(reason, description) {
			console.log("Client _connection close");
			
			this._publisher.publish({
				"/disconnect": {
					reason: reason,
					description: description
				}
			});
		}).bind(this));
	}

	return Client;
});
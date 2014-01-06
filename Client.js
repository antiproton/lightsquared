define(function(require) {
	var Event=require("lib/Event");
	var time=require("lib/time");
	var Publisher=require("lib/Publisher");
	
	function Client(connection) {
		this._connection=connection;
		this._timeLastMessageReceived=null;
		this._timeLastMessageSent=null;
		this._timeConnected=time();
		this._user=null;
		this._publisher=new Publisher();
		
		this._connection.on("message", (function(message) {
			if(message.type==="utf8") {
				this._publisher.publish(JSON.parse(message.utf8Data));
				this._timeLastMessageSent=time();
			}
		}).bind(this));

		this._connection.on("close", (function(reason, description) {
			this._publisher.publish({
				"/disconnect": {
					reason: reason,
					description: description
				}
			});
		}).bind(this));
	}

	Client.prototype.sendMessage=function(data) {
		this._connection.sendUTF(JSON.stringify(data));
		this._timeLastMessageReceived=time();
	}

	Client.prototype.disconnect=function() {
		this._connection.close();
	}
	
	Client.prototype.getTimeLastActive=function() {
		return Math.max(this._timeConnected, this._timeLastMessageSent);
	}
	
	Client.prototype.getUser=function() {
		return this._user;
	}
	
	Client.prototype.setUser=function(user) {
		this._user=user;
	}

	return Client;
});
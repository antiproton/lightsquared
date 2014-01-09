define(function(require) {
	var Event=require("lib/Event");
	var time=require("lib/time");
	var Publisher=require("lib/Publisher");
	
	function Client(connection, session) {
		this.session=session;
		this._connection=connection;
		
		this.Disconnected=new Event(this);
		
		this._timeLastMessageReceived=0;
		this._timeLastMessageSent=0;
		this._timeConnected=time();
		
		this._publisher=new Publisher();
		
		this._connectionMessageHandler=(function(message) {
			if(message.type==="utf8") {
				this._publisher.publish(JSON.parse(message.utf8Data));
				this._timeLastMessageSent=time();
			}
		}).bind(this);
		
		this._connectionCloseHandler=(function(reason, description) {
			this.Disconnected.fire({
				reason: reason,
				description: description
			});
		}).bind(this);
		
		this._setupConnection();
	}
	
	Client.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	Client.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}

	Client.prototype.send=function(data) {
		this._connection.sendUTF(JSON.stringify(data));
		this._timeLastMessageReceived=time();
	}
	
	Client.prototype.sendKeepAliveMessage=function(maxTimeBetweenMessages) {
		if(time()-this._timeLastMessageReceived>maxTimeBetweenMessages) {
			this.send({});
		}
	}
	
	Client.prototype.close=function() {
		this._connection.close();
		this._teardownConnection();
	}
	
	Client.prototype.getTimeLastActive=function() {
		return Math.max(this._timeConnected, this._timeLastMessageSent);
	}
	
	Client.prototype._setupConnection=function() {
		this._connection.on("message", this._connectionMessageHandler);
		this._connection.on("close", this._connectionCloseHandler);
	}
	
	Client.prototype._teardownConnection=function() {
		this._connection.off("message", this._connectionMessageHandler);
		this._connection.off("close", this._connectionCloseHandler);
	}

	return Client;
});
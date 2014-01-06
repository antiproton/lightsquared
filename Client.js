define(function(require) {
	var Event=require("lib/Event");
	var time=require("lib/time");
	
	function Client(connection) {
		this._connection=connection;
		this._timeLastMessageReceived=null;
		this._timeLastMessageSent=null;
		this._timeConnected=time();
		
		this.SentMessage=new Event(this);
		this.Disconnected=new Event(this);
		
		var self=this;
		
		this._connection.on("message", function(message) {
			if(message.type==="utf8") {
				self.SentMessage.fire({
					message: JSON.parse(message.utf8Data)
				});
				
				self._timeLastMessageSent=time();
			}
		});

		this._connection.on("close", function(reason, description) {
			self.Disconnected.fire({
				reason: reason,
				description: description
			});
		});
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

	return Client;
});
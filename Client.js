define(function(require) {
	var Event=require("lib/Event");
	var time=require("lib/time");
	var Publisher=require("lib/Publisher");
	require("lib/Array.remove");
	
	function urlStartsWithPath(url, path) {
		return (path==="/" || url===path || url.substr(0, path.length+1)===path+"/");
	}
	
	function Client(connection) {
		this._connection=connection;
		this._publisher=new Publisher();
		
		this.Disconnected=new Event(this);
		
		this._timeLastMessageReceived=0;
		this._timeLastMessageSent=0;
		this._timeConnected=time();
		
		this._interestingPaths=[
			"/"
		];
		
		this._publisher.subscribe("/interested", (function(url) {
			this._interestingPaths.push(url);
		}).bind(this));
		
		this._publisher.subscribe("/not-interested", (function(url) {
			this._interestingPaths.remove(url);
		}).bind(this));
		
		this._setupConnection();
	}
	
	Client.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	Client.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}

	Client.prototype.send=function(url, data) {
		this._interestingPaths.forEach((function(path) {
			if(urlStartsWithPath(url, path)) {
				this._connection.sendUTF(JSON.stringify({
					url: url,
					data: data
				}));
				
				this._timeLastMessageSent=time();
			}
		}).bind(this));
	}
	
	Client.prototype.sendKeepAliveMessage=function(maxTimeBetweenMessages) {
		if(time()-this._timeLastMessageSent>maxTimeBetweenMessages) {
			this.send("/keepalive");
		}
	}
	
	Client.prototype.getTimeLastActive=function() {
		return Math.max(this._timeConnected, this._timeLastMessageReceived);
	}
	
	Client.prototype._setupConnection=function() {
		this._connection.on("message", (function(message) {
			if(message.type==="utf8") {
				var data=JSON.parse(message.utf8Data);
				
				this._publisher.publish(data.url, data.data);
				this._timeLastMessageReceived=time();
			}
		}).bind(this));
		
		this._connection.on("close", (function(reason, description) {
			this.Disconnected.fire({
				reason: reason,
				description: description
			});
		}).bind(this));
	}

	return Client;
});
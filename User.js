define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.remove");
	
	function User(client) {
		this._id=id();
		this.Connected=new Event(this);
		this.Disconnected=new Event(this);
		this._clients=[client];
		this._publisher=new Publisher();
	}
	
	User.prototype.addClient=function(client) {
		this._clients.push(client);
		
		if(this._clients.length===1) {
			this.Connected.fire();
		}
		
		client.Disconnected.addHandler(this, function() {
			this._removeClient(client);
		});
		
		client.subscribe("*", (function(url, data) {
			this._publisher.publish(url, data);
		}).bind(this));
	}
	
	User.prototype._removeClient=function(client) {
		this._clients.remove(client);
		
		if(this._clients.length===0) {
			this.Disconnected.fire();
		}
	}
	
	User.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}
	
	User.prototype.send=function(url, data) {
		this._clients.forEach(function(client) {
			client.send(url, data);
		});
	}
	
	return User;
});
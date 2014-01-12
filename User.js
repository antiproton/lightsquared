define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.contains");
	var id=require("lib/id");
	
	function User(client) {
		this._client=client;
		this._publisher=new Publisher();
		this.username="Anonymous"+id();
		
		this._client.subscribe("*", (function(dataByUrl) {
			this._publisher.publish(dataByUrl);
		}).bind(this));
	}
	
	User.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}
	
	User.prototype.send=function(dataByUrl) {
		this._client.send(dataByUrl);
		this._client.send(this.username);
	}
	
	User.prototype._publish=function(dataByUrl) {
		this._publisher.publish(dataByUrl);
	}
	
	return User;
});
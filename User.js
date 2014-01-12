define(function(require) {
	var Publisher=require("lib/Publisher");
	
	function User(client) {
		this._client=client;
		this._publisher=new Publisher();
		
		this._client.subscribe("*", (function(dataByUrl) {
			this._publisher.publish(dataByUrl);
		}).bind(this));
		
		this._ignoredUrls=[];
		this._messageFiltersByUrl={};
		
		this.subscribe("/filter_add", (function(data) {
			
		}).bind(this));
	}
	
	User.prototype.subscribe=function(url, callback) {
		this._client.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe=function(url, callback) {
		this._client.unsubscribe(url, callback);
	}
	
	User.prototype.send=function(dataByUrl) {
		this._client.send(dataByUrl);
	}
	
	return User;
});
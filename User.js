define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.contains");
	
	function User(client) {
		this._client=client;
		this._publisher=new Publisher();
		
		this._client.subscribe("*", (function(dataByUrl) {
			this._publisher.publish(dataByUrl);
		}).bind(this));
		
		this._ignoredUrls=[];
		this._messageFiltersByUrl={};
		
		/*
		TODO initialise filters with appropriate rating min/max etc
		*/
		
		this._client.subscribe("/filter/add", (function(data) {
			
		}).bind(this));
		
		this._client.subscribe("/filter/remove", (function(data) {
			//...
			this._publish("/request/challenge_list");
		}).bind(this));
		
		this._client.subscribe("/filter/clear", (function(url) {
			delete this._messageFiltersByUrl[url];
			this._publish("/request/challenge_list");
		}).bind(this));
	}
	
	User.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}
	
	User.prototype.send=function(dataByUrl) {
		var filteredData={};
		
		for(var url in dataByUrl) {
			if(!this._ignoredUrls.contains(url)) {
				if(url in this._messageFiltersByUrl) {
					
				}
				
				else {
					filteredData[url]=dataByUrl[url];
				}
			}
		}
		
		this._client.send(filteredData);
	}
	
	User.prototype._publish=function(dataByUrl) {
		this._publisher.publish(dataByUrl);
	}
	
	return User;
});
define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.contains");
	require("lib/Array.remove");
	var id=require("lib/id");
	
	function urlStartsWithPath(url, path) {
		return (url===path || url.substr(0, path.length+1)===path+"/");
	}
	
	function User(client) {
		this._client=client;
		this._publisher=new Publisher();
		this._isAnonymous=true;
		
		this._interestingPaths=[
			"/game",
			"/direct_challenge"
		];
		
		this._username="Anonymous"+id();
		
		if("username" in this._client.session) {
			this._username=this._client.session["username"];
			this._isAnonymous=false;
		}
		
		this._client.Disconnected.addHandler(this, function() {
			this._publisher.publish("/disconnected");
		});
		
		this._client.subscribe("*", (function(dataByUrl) {
			this._publisher.publish(dataByUrl);
		}).bind(this));
		
		this._client.subscribe("/interested", (function(data) {
			this._interestingPaths.push(data.url);
		}).bind(this));
		
		this._client.subscribe("/not_interested", (function(data) {
			this._interestingPaths.remove(data.url);
		}).bind(this));
	}
	
	User.prototype.sendCurrentTables=function(tables) {
		if(!("current_tables" in this._client.session)) {
			this._client.session["current_tables"]=[];
			
			tables.forEach((function(table) {
				if(this.isAtTable(table)) {
					this._client.session["current_tables"].push(table);
				}
			}).bind(this));
		}
		
		this.send({
			"/tables": this._client.session["current_tables"]
		});
	}
	
	User.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}
	
	User.prototype.send=function(dataByUrl) {
		var interestingData={};
		
		for(var url in dataByUrl) {
			this._interestingPaths.forEach(function(path) {
				if(urlStartsWithPath(url, path)) {
					interestingData[url]=dataByUrl[url];
				}
			});
		}
		
		this._client.send(interestingData);
	}
	
	User.prototype.isAtTable=function(table) {
		return (table.userIsSeated(this) || table.userIsWatching(this));
	}
	
	User.prototype.getUsername=function() {
		return this._username;
	}
	
	return User;
});
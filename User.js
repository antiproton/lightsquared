define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.contains");
	var id=require("lib/id");
	
	function User(client) {
		this._client=client;
		this._publisher=new Publisher();
		this._isAnonymous=true;
		this.username="Anonymous"+id();
		
		if("username" in this._client.session) {
			this.username=this._client.session["username"];
			this._isAnonymous=false;
		}
		
		this._client.Disconnected.addHandler(this, function() {
			this._publisher.publish("/disconnected");
		});
		
		this._client.subscribe("*", (function(dataByUrl) {
			this._publisher.publish(dataByUrl);
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
		this._client.send(dataByUrl);
	}
	
	User.prototype.isAtTable=function(table) {
		return (table.userIsSeated(this) || table.userIsWatching(this));
	}
	
	return User;
});
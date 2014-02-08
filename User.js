define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.contains");
	require("lib/Array.remove");
	var id=require("lib/id");
	
	function urlStartsWithPath(url, path) {
		return (path==="/" || url===path || url.substr(0, path.length+1)===path+"/");
	}
	
	function User(client) {
		this._id=id();
		this._client=client;
		this._session=this._client.getSession();
		this._publisher=new Publisher();
		this._gamesPlayedAsWhite=0;
		this._gamesPlayedAsBlack=0;
		
		this._interestingPaths=[
			"/" //DEBUG interested in everything for testing purposes
		];
		
		this._username="Anonymous";
		
		if("username" in this._session) {
			this._username=this._session["username"];
		}
		
		this._client.Disconnected.addHandler(this, function() {
			this._publisher.publish("/disconnected");
		});
		
		this._client.subscribe("*", (function(url, data) {
			this._publisher.publish(url, data);
		}).bind(this));
		
		this._client.subscribe("/interested", (function(url) {
			this._interestingPaths.push(url);
		}).bind(this));
		
		this._client.subscribe("/not-interested", (function(url) {
			this._interestingPaths.remove(url);
		}).bind(this));
	}
	
	User.prototype.getId=function() {
		return this._id;
	}
	
	User.prototype.toString=function() {
		return this._id;
	}
	
	User.prototype.sendCurrentTables=function(tables) {
		if(!("current_tables" in this._session)) {
			this._session["current_tables"]=[];
			
			var table;
			
			for(var id in tables) {
				table=tables[id];
				
				if(this.isAtTable(table)) {
					this._session["current_tables"].push(table);
				}
			}
		}
		
		this.send("/tables", this._session["current_tables"]);
	}
	
	User.prototype.subscribe=function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe=function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}
	
	User.prototype.send=function(url, data) {
		this._interestingPaths.forEach((function(path) {
			if(urlStartsWithPath(url, path)) {
				this._client.send(url, data);
			}
		}).bind(this));
	}
	
	User.prototype.isAtTable=function(table) {
		return (table.userIsSeated(this) || table.userIsWatching(this));
	}
	
	User.prototype.getUsername=function() {
		return this._username;
	}
	
	User.prototype.getGamesAsWhiteRatio=function() {
		Math.max(1, this._gamesPlayedAsWhite)/Math.max(1, this._gamesPlayedAsBlack);
	}
	
	User.prototype.toJSON=function() {
		return {
			id: this._id,
			username: this._username
		};
	}
	
	return User;
});
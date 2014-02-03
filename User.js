define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.contains");
	require("lib/Array.remove");
	var id=require("lib/id");
	
	function urlStartsWithPath(url, path) {
		return (url===path || url.substr(0, path.length+1)===path+"/");
	}
	
	function User(client) {
		this._id=id();
		this._client=client;
		this._session=this._client.getSession();
		this._publisher=new Publisher();
		this._isAnonymous=true;
		this._gamesPlayedAsWhite=0;
		this._gamesPlayedAsBlack=0;
		
		this._interestingPaths=[
			"/challenges",
			"/game",
			"/direct_challenge"
		];
		
		this._username="Anonymous"+id();
		
		if("username" in this._session) {
			this._username=this._session["username"];
			this._isAnonymous=false;
		}
		
		this._client.Disconnected.addHandler(this, function() {
			this._publisher.publish("/disconnected");
		});
		
		this._client.subscribe("*", (function(url, data) {
			this._publisher.publish(url, data);
		}).bind(this));
		
		this._client.subscribe("/interested", (function(data) {
			this._interestingPaths.push(data.url);
		}).bind(this));
		
		this._client.subscribe("/not_interested", (function(data) {
			this._interestingPaths.remove(data.url);
		}).bind(this));
	}
	
	User.prototype.getId=function() {
		return this._id;
	}
	
	User.prototype.sendCurrentTables=function(tables) {
		if(!("current_tables" in this._session)) {
			this._session["current_tables"]=[];
			
			tables.forEach((function(table) {
				if(this.isAtTable(table)) {
					this._session["current_tables"].push(table);
				}
			}).bind(this));
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
	
	return User;
});
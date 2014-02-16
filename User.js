define(function(require) {
	var Publisher=require("lib/Publisher");
	require("lib/Array.remove");
	var id=require("lib/id");
	
	function User(user) {
		this._id=id();
		this._user=user;
		this.Connected=new Event(this);
		this.Disconnected=new Event(this);
		this._username="Anonymous";
		this._publisher=new Publisher();
		this._gamesPlayedAsWhite=0;
		this._gamesPlayedAsBlack=0;
		
		if("username" in this._session) {
			this._username=this._session["username"];
		}
		
		this._user.Disconnected.addHandler(this, function() {
			this.Disconnected.fire();
		});
		
		this._user.Connected.addHandler(this, function() {
			this.Connected.fire();
		});
		
		//FIXME new user every time ...
		
		/*
		
		options:
		
			use session (database call every time to log in, or keep it all in the session?)
			extend User so that all users are ChessUsers (how to tell the server about that?)
			
		*/
		
		this._user.subscribe("*", (function(url, data) {
			this._publisher.publish(url, data);
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
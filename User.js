define(function(require) {
	var Publisher=require("lib/Publisher");
	var id=require("lib/id");
	var Event=require("lib/Event");
	var db=require("lib/db/db");
	
	function User(user) {
		this._id=id();
		this._user=user;
		this._session=user.getSession();
		this._username="Anonymous";
		this._publisher=new Publisher();
		this._gamesPlayedAsWhite=0;
		this._gamesPlayedAsBlack=0;
		
		this.Connected=new Event(this);
		this.Disconnected=new Event(this);
		
		if("user" in this._session) {
			this._loadJSON(this._session["user"]);
		}
		
		this._user.Disconnected.addHandler(this, function() {
			this.Disconnected.fire();
		});
		
		this._user.Connected.addHandler(this, function() {
			this.Connected.fire();
		});
		
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
	
	User.prototype.login=function(username, password) {
		
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
		this._user.send(url, data);
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
			username: this._username,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack
		};
	}
	
	User.prototype._loadJSON=function(json) {
		this._username=json.username;
		this._gamesPlayedAsWhite=json.gamesPlayedAsWhite;
		this._gamesPlayedAsBlack=json.gamesPlayedAsBlack;
	}
	
	return User;
});
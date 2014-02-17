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
		this._password=null;
		this._isLoggedIn=false;
		this._publisher=new Publisher();
		this._gamesPlayedAsWhite=0;
		this._gamesPlayedAsBlack=0;
		
		this.Connected=new Event(this);
		this.Disconnected=new Event(this);
		
		if("user" in this._session) {
			this._loadJSON(this._session["user"]);
		}
		
		else {
			this._session["user"]=this.toJSON();
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
		
		this._user.subscribe("/user/login", function(data) {
			this._login(data.username, data.password);
		});
		
		this._user.subscribe("/user/logout", function() {
			this._logout();
		});
		
		this._user.subscribe("/user/register", function(data) {
			this._register(data.username, data.password);
		});
	}
	
	User.prototype.getId=function() {
		return this._id;
	}
	
	User.prototype.toString=function() {
		return this._id;
	}
	
	User.prototype._login=function(username, password) {
		if(!this._isLoggedIn) {
			db.query("select * from users where username = ? and password = ?", username, password, function(rows) {
				if(rows.length===1) {
					this._loadJSON(rows[0]);
					this._isLoggedIn=true;
					this._user.send("/user/login/success");
				}
			});
		}
		
		if(!this._isLoggedIn) {
			this._user.send("/user/login/failure");
		}
	}
	
	User.prototype._logout=function() {
		if(this._isLoggedIn) {
			this._isLoggedIn=false;
			this._username="Anonymous";
			this._user.send("/user/logout");
		}
	}
	
	User.prototype._register=function(username, password) {
		db.insert("users", this.toJSON()); //TODO
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
	
	User.prototype.isLoggedIn=function() {
		return this._isLoggedIn;
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
	
	User.prototype._loadJSON=function(data) {
		this._username=data.username;
		this._gamesPlayedAsWhite=data.gamesPlayedAsWhite;
		this._gamesPlayedAsBlack=data.gamesPlayedAsBlack;
		
		this._publisher.publish("/update", this);
	}
	
	return User;
});
define(function(require) {
	var Publisher = require("lib/Publisher");
	var id = require("lib/id");
	var Event = require("lib/Event");
	var db = require("lib/db/db");
	var Glicko = require("chess/Glicko");
	
	function User(user, app) {
		this._id = id();
		this._user = user;
		this._app = app;
		this._session = user.getSession();
		this._username = "Anonymous";
		this._password = null;
		this._isLoggedIn = false;
		this._publisher = new Publisher();
		this._gamesPlayedAsWhite = 0;
		this._gamesPlayedAsBlack = 0;
		this._rating = Glicko.INITIAL_RATING;
		
		this.Connected = new Event(this);
		this.Disconnected = new Event(this);
		this.LoggedIn = new Event(this);
		this.LoggedOut = new Event(this);
		this.Replaced = new Event(this);
		
		this._user.Disconnected.addHandler(this, function() {
			this.Disconnected.fire();
		});
		
		this._user.Connected.addHandler(this, function() {
			this.Connected.fire();
		});
		
		this._loadFromSession();
		this._session.user = this;
		
		if(!this._session.currentGames) {
			this._session.currentGames = [];
		}
		
		this._subscribeToUserMessages();
	}
	
	User.prototype.getRating = function() {
		return this._rating;
	}
	
	User.prototype.getGamesPlayedAsWhite = function() {
		return this._gamesPlayedAsWhite;
	}
	
	User.prototype.getGamesPlayedAsBlack = function() {
		return this._gamesPlayedAsBlack;
	}
	
	User.prototype.updateRating = function(newRating) {
		this._rating = newRating;
	}
	
	User.prototype.replace = function(user) {
		user.replaceWith(this);
	}
	
	User.prototype.replaceWith = function(user) {
		this.Replaced.fire({
			newUser: user
		});
		
		this._user.send("/user/replaced");
		this._user.disconnect();
	}
	
	User.prototype.getId = function() {
		return this._id;
	}
	
	User.prototype._login = function(username, password) {
		db.query("select * from users where username = ? and password = ?", [username, password], function(rows) {
			if(rows.length === 1) {
				this._loadRow(rows[0]);
				this._isLoggedIn = true;
				
				this.LoggedIn.fire({
					username: username
				});
				
				this._user.send("/user/login/success");
			}
			
			else {
				this._user.send("/user/login/failure");
			}
		});
	}
	
	User.prototype._logout = function() {
		if(this._isLoggedIn) {
			this._isLoggedIn = false;
			this._username = "Anonymous";
			this.LoggedOut.fire();
			this._user.send("/user/logout");
		}
	}
	
	User.prototype._register = function(username, password) {
		db.query("select username from users where username = ?", [username], (function(rows) {
			if(rows.length === 0) {
				db.insert("users", this._toRow());
				
				this._user.send("/user/register/success", this);
			}
			
			else {
				this._user.send("/user/register/failure");
			}
		}).bind(this));
	}
	
	User.prototype._save = function() {
		db.update("users", this._toRow(), {
			username: this._username
		});
	}
	
	User.prototype.subscribe = function(url, callback) {
		this._publisher.subscribe(url, callback);
	}
	
	User.prototype.unsubscribe = function(url, callback) {
		this._publisher.unsubscribe(url, callback);
	}
	
	User.prototype.send = function(url, data) {
		this._user.send(url, data);
	}
	
	User.prototype.getUsername = function() {
		return this._username;
	}
	
	User.prototype.isLoggedIn = function() {
		return this._isLoggedIn;
	}
	
	User.prototype.getGamesAsWhiteRatio = function() {
		Math.max(1, this._gamesPlayedAsWhite) / Math.max(1, this._gamesPlayedAsBlack);
	}
	
	User.prototype._subscribeToUserMessages = function() {
		this._user.subscribe("*", (function(url, data) {
			this._publisher.publish(url, data);
		}).bind(this));
		
		this._user.subscribe("/user/login", (function(data) {
			this._login(data.username, data.password);
		}).bind(this));
		
		this._user.subscribe("/user/logout", (function() {
			this._logout();
		}).bind(this));
		
		this._user.subscribe("/user/register", (function(data) {
			this._register(data.username, data.password);
		}).bind(this));
		
		this._user.subscribe("/challenge/create", (function(options) {
			var challenge = this._app.createChallenge(this, options);
			
			challenge.Accepted.addHandler(this, function(data) {
				var game = data.game;
				
				this._session.currentGames.push(game);
				
				return true;
			});
		}).bind(this));
		
		this._user.subscribe("/game/spectate", (function(id) {
			var game = this._app.getGame(id);
			
			if(game !== null) {
				game.spectate(this);
				
				this._session.currentGames.push(game);
			}
		}).bind(this));
		
		this._user.subscribe("/challenge/accept", (function(id) {
			this._app.acceptChallenge(this, id);
		}).bind(this));
		
		this._user.subscribe("/request/games", (function() {
			this._user.send("/games", this._session.currentGames);
		}).bind(this));
		
		this._user.subscribe("/request/challenges", (function() {
			this._user.send("/challenges", this._app.getOpenChallenges());
		}).bind(this));
	}
	
	User.prototype.toJSON = function() {
		return {
			username: this._username,
			isLoggedIn: this._isLoggedIn,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack,
			rating: this._rating
		};
	}
	
	User.prototype._toRow = function() {
		return {
			username: this._username,
			password: this._password,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack,
			rating: this._rating
		};
	}
	
	User.prototype._loadRow = function(row) {
		this._username = row.username;
		this._password = row.password;
		this._gamesPlayedAsWhite = row.gamesPlayedAsWhite;
		this._gamesPlayedAsBlack = row.gamesPlayedAsBlack;
		this._rating = row.rating;
	}
	
	User.prototype._loadFromSession = function() {
		if(this._session.user) {
			var user = this._session.user;
			
			this._username = user.getUsername();
			this._gamesPlayedAsWhite = user.getGamesPlayedAsWhite();
			this._gamesPlayedAsBlack = user.getGamesPlayedAsBlack();
			this._rating = user.getRating();
			this._isLoggedIn = user.isLoggedIn();
		}
	}
	
	return User;
});
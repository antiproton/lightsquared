define(function(require) {
	var id = require("js/id");
	var Event = require("js/Event");
	
	function Player(user) {
		this._id = id();
		this._user = user;
		
		this.Disconnected = new Event(this);
		this.Connected = new Event(this);
		
		this._setupUser();
	}
	
	Player.prototype._setupUser = function() {
		this._userHandlers = [
			this._user.Disconnected.addHandler(function() {
				this.Disconnected.fire();
			}, this),
			
			this._user.Connected.addHandler(function() {
				this.Connected.fire();
			}, this)
		];
	}
	
	Player.prototype.getId = function() {
		return this._id;
	}
	
	Player.prototype.getRating = function() {
		return this._user.getRating();
	}
	
	Player.prototype.getGlicko2 = function() {
		return this._user.getGlicko2();
	}
	
	Player.prototype.getGamesAsWhiteRatio = function() {
		return this._user.getGamesAsWhiteRatio();
	}
	
	Player.prototype.getName = function() {
		return this._user.getUsername();
	}
	
	Player.prototype.isUser = function() {
		return true;
	}
	
	Player.prototype.setUser = function(user) {
		this._userHandlers.forEach(function(handler) {
			handler.remove();
		});
		
		this._user = user;
		this._setupUser();
	}
	
	Player.prototype.toJSON = function() {
		return {
			id: this._id,
			name: this.getName(),
			rating: this.getRating(),
			isUser: true,
			isConnected: this._user.isConnected()
		};
	}
	
	return Player;
});
define(function(require) {
	var id = require("lib/id");
	
	function Player(user) {
		this._id = id();
		this._user = user;
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
	
	Player.prototype.setUser = function(user) {
		this._user = user;
	}
	
	Player.prototype.toJSON = function() {
		return {
			id: this._id,
			name: this.getName(),
			rating: this.getRating()
		};
	}
	
	return Player;
});
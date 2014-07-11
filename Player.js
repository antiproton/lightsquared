define(function(require) {
	function Player(user) {
		this._user = user;
	}
	
	Player.prototype.getRating = function() {
		return this._user.getRating();
	}
	
	Player.prototype.setUser = function(user) {
		this._user = user;
	}
	
	Player.prototype.toJSON = function() {
		return this._user.toJSON();
	}
	
	return Player;
});
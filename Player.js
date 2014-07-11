define(function(require) {
	var Event = require("lib/Event");
	
	/*
	player should remove games from its list as soon as they are over.
	User can be responsible for persisting them for longer
	*/
	
	function Player(app, rating) {
		this._app = app;
		
		this._rating = rating;
		this._currentGames = [];
		this._currentChallenge = null;
		this._lastChallengeOptions = null;
		
		
		this.NewGame = new Event(this);
	}
	
	Player.prototype.setRating = function(rating) {
		this._rating = rating;
	}
	
	/*
	Player has a rating, but it's just set by whatever is using it.
	
	User sets it from the DB; Bot sets it based on the strength of the engine settings.
	
	It is currently only needed here because Game uses it to keep a record of
	what the players' ratings were at the time.
	*/
	
	Player.prototype.createChallenge = function(options) {
		
	}
	
	Player.prototype.acceptChallenge = function(id) {
		
	}
	
	return Player;
});
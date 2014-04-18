define(function(require) {
	var id = require("lib/id");
	var Colour = require("chess/Colour");
	var Event = require("lib/Event");
	var Game = require("./Game");
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		this._players = {};
		this._players[Colour.white] = null;
		this._players[Colour.black] = null;
		
		this.Accepted = new Event(this);
		
		this._options = {
			initialTime: "10m",
			timeIncrement: "0"
		};
		
		for(var p in options) {
			this._options[p] = options[p];
		}
	}
	
	Challenge.prototype.getId = function() {
		return this._id;
	}
	
	Challenge.prototype.accept = function(user) {
		var ownerRatio = this._owner.getGamesAsWhiteRatio();
		var guestRatio = user.getGamesAsWhiteRatio();
		
		if(ownerRatio > guestRatio) {
			this._players[Colour.white] = user;
			this._players[Colour.black] = this._owner;
		}
		
		else {
			this._players[Colour.white] = this._owner;
			this._players[Colour.black] = user;
		}
		
		var game = new Game(this._players[Colour.white], this._players[Colour.black], this._options);
		
		this.Accepted.fire({
			game: game
		});
	}
	
	Challenge.prototype.toJSON = function() {
		return {
			id: this._id,
			owner: this._owner,
			options: this._options
		};
	}
	
	return Challenge;
});
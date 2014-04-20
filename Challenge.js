define(function(require) {
	var id = require("lib/id");
	var Event = require("lib/Event");
	var Game = require("./Game");
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		
		this._options = {
			initialTime: "10m",
			timeIncrement: "0",
			acceptRatingMin: "-100",
			acceptRatingMax: "+100"
		};
		
		if(options) {
			for(var p in options) {
				this._options[p] = options[p];
			}
		}
		
		this._acceptRatingMin = this._getAbsoluteGuestRating(this._options.acceptRatingMin);
		this._acceptRatingMax = this._getAbsoluteGuestRating(this._options.acceptRatingMax);
	}
	
	Challenge.prototype.getId = function() {
		return this._id;
	}
	
	Challenge.prototype.accept = function(user) {
		var game = null;
		var guestRating = user.getRating();
		
		if(guestRating >= this._acceptRatingMin && guestRating <= this._acceptRatingMax) {
			var white, black;
			var ownerRatio = this._owner.getGamesAsWhiteRatio();
			var guestRatio = user.getGamesAsWhiteRatio();
			
			if(ownerRatio > guestRatio) {
				white = user;
				black = this._owner;
			}
			
			else {
				white = this._owner;
				black = user;
			}
			
			game = new Game(white, black, {
				initialTime: this._options.initialTime,
				timeIncrement: this._options.timeIncrement
			});
		}
		
		return game;
	}
	
	Challenge.prototype._getAbsoluteGuestRating = function(ratingSpecifier) {
		var firstChar = ratingSpecifier.charAt(0);
		
		if(firstChar === "-" || firstChar === "+") {
			return this._owner.getRating() + parseInt(ratingSpecifier);
		}
		
		else {
			return parseInt(ratingSpecifier);
		}
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
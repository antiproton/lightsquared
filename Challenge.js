define(function(require) {
	var id = require("lib/id");
	var Event = require("lib/Event");
	var Game = require("./Game");
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		
		this.Accepted = new Event(this);
		
		this._options = {
			initialTime: "10m",
			timeIncrement: "0",
			acceptsRatingMin: "-100",
			acceptsRatingMax: "+100"
		};
		
		this._acceptsRatingMin = this._getAbsolutePlayerRating(this._options.acceptsRatingMin);
		this._acceptsRatingMax = this._getAbsolutePlayerRating(this._options.acceptsRatingMax);
		
		for(var p in options) {
			this._options[p] = options[p];
		}
	}
	
	Challenge.prototype.getId = function() {
		return this._id;
	}
	
	Challenge.prototype.accept = function(user) {
		var guestRating = user.getRating();
		
		if(guestRating >= this._acceptsRatingMin && guestRating <= this._acceptsRatingMax) {
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
			
			var game = new Game(white, black, this._options);
			
			this.Accepted.fire({
				game: game
			});
		}
	}
	
	Challenge.prototype._getAbsolutePlayerRating = function(ratingSpecifier) {
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
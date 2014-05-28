define(function(require) {
	var id = require("lib/id");
	var Event = require("lib/Event");
	var Game = require("./Game");
	
	var TIME_BEFORE_EXPIRY = 60000;
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		
		this.Accepted = new Event(this);
		this.Expired = new Event(this);
		
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
		
		this._expireTimer = setTimeout((function() {
			this.Expired.fire();
		}).bind(this), TIME_BEFORE_EXPIRY);
	}
	
	Challenge.prototype.getId = function() {
		return this._id;
	}
	
	Challenge.prototype.accept = function(user) {
		var guestRating = user.getRating();
		var game = null;
		
		if(user !== this._owner && guestRating >= this._acceptRatingMin && guestRating <= this._acceptRatingMax) {
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
			
			this._clearExpireTimer();
			
			this.Accepted.fire({
				game: game
			});
		}
		
		return game;
	}
	
	Challenge.prototype.cancel = function() {
		this._clearExpireTimer();
		this.Expired.fire();
	}
	
	Challenge.prototype._clearExpireTimer = function() {
		if(this._expireTimer !== null) {
			clearTimeout(this._expireTimer);
			
			this._expireTimer = null;
		}
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
define(function(require) {
	var id = require("lib/id");
	var time = require("lib/time");
	var Event = require("lib/Event");
	var Game = require("./Game");
	var jsonChessConstants = require("jsonchess/constants");
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		
		this.Expired = new Event();
		this.Accepted = new Event();
		
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
		
		if(Time.fromUnitString(this._options.initialTime, Time.minutes).getMilliseconds() === 0) {
			throw "Initial time must be at least 1s";
		}
		
		this._acceptRatingMin = this._getAbsoluteRating(this._options.acceptRatingMin);
		this._acceptRatingMax = this._getAbsoluteRating(this._options.acceptRatingMax);
		
		this._timeoutTimer = setTimeout((function() {
			this._timeout();
		}).bind(this), jsonChessConstants.CHALLENGE_TIMEOUT);
		
		this._expiryTime = time() + jsonChessConstants.CHALLENGE_TIMEOUT;
	}
	
	Challenge.prototype.getId = function() {
		return this._id;
	}
	
	Challenge.prototype.accept = function(player) {
		var guestRating = player.getRating();
		var game = null;
		
		if(player !== this._owner && guestRating >= this._acceptRatingMin && guestRating <= this._acceptRatingMax) {
			var white, black;
			var ownerRatio = this._owner.getGamesAsWhiteRatio();
			var guestRatio = player.getGamesAsWhiteRatio();
			
			if(ownerRatio > guestRatio) {
				white = player;
				black = this._owner;
			}
			
			else {
				white = this._owner;
				black = player;
			}
			
			game = new Game(white, black, {
				initialTime: this._options.initialTime,
				timeIncrement: this._options.timeIncrement
			});
			
			this._clearTimeoutTimer();
			this.Accepted.fire(game);
			this.Expired.fire();
		}
		
		return game;
	}
	
	Challenge.prototype.cancel = function() {
		this._clearTimeoutTimer();
		this.Expired.fire();
	}
	
	Challenge.prototype._timeout = function() {
		this.Expired.fire();
	}
	
	Challenge.prototype._clearTimeoutTimer = function() {
		if(this._timeoutTimer !== null) {
			clearTimeout(this._timeoutTimer);
			
			this._timeoutTimer = null;
		}
	}
	
	Challenge.prototype._getAbsoluteRating = function(ratingSpecifier) {
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
			options: this._options,
			expiryTime: this._expiryTime
		};
	}
	
	return Challenge;
});
define(function(require) {
	var id = require("lib/id");
	var time = require("lib/time");
	var Event = require("lib/Event");
	var jsonChessConstants = require("jsonchess/constants");
	var Time = require("chess/Time");
	var Game = require("./Game");
	
	function Seek(owner, options) {
		this._id = id();
		this._owner = owner;
		
		this.Expired = new Event();
		this.Matched = new Event();
		
		var rating = owner.getRating();
		
		this._options = {
			initialTime: Time.fromUnitString("10m"),
			timeIncrement: 0,
			acceptRatingMin: Math.max(0, rating - 100),
			acceptRatingMax: rating + 100
		};
		
		if(options) {
			for(var p in options) {
				this._options[p] = options[p];
			}
		}
		
		if(this._options.initialTime < Time.fromUnitString("1s")) {
			throw "Initial time must be at least 1s";
		}
		
		this._timeoutTimer = setTimeout((function() {
			this._timeout();
		}).bind(this), jsonChessConstants.SEEK_TIMEOUT);
		
		this._expiryTime = time() + jsonChessConstants.SEEK_TIMEOUT;
	}
	
	Seek.prototype.getId = function() {
		return this._id;
	}
	
	Seek.prototype.accept = function(player) {
		var game = null;
		
		if(player !== this._owner && this.matchesPlayer(player)) {
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
			this.Matched.fire(game);
		}
		
		return game;
	}
	
	Seek.prototype.matchesPlayer = function(player) {
		var rating = player.getRating();
		
		return (rating >= this._options.acceptRatingMin && rating <= this._options.acceptRatingMax);
	}
	
	Seek.prototype.matchesOptions = function(options) {
		return (
			options.initialTime === this._options.initialTime
			&& options.timeIncrement === this._options.timeIncrement
		);
	}
	
	Seek.prototype.cancel = function() {
		this._clearTimeoutTimer();
		this.Expired.fire();
	}
	
	Seek.prototype._timeout = function() {
		this.Expired.fire();
	}
	
	Seek.prototype._clearTimeoutTimer = function() {
		if(this._timeoutTimer !== null) {
			clearTimeout(this._timeoutTimer);
			
			this._timeoutTimer = null;
		}
	}
	
	Seek.prototype.toJSON = function() {
		return {
			id: this._id,
			owner: this._owner,
			options: this._options,
			expiryTime: this._expiryTime
		};
	}
	
	return Seek;
});
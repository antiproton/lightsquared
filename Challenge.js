define(function(require) {
	var id = require("lib/id");
	var Colour = require("chess/Colour");
	var Event = require("lib/Event");
	var Game = require("./Game");
	var Fen = require("chess/Fen");
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		this._players = {};
		this._players[Colour.white] = null;
		this._players[Colour.black] = null;
		
		this.Accepted = new Event(this);
		
		this._options = {
			ownerPlaysAs: null,
			startingFen: Fen.STARTING_FEN,
			clockStartHalfmove: 1,
			clockStartDelay: 0,
			initialTime: 600,
			timeIncrement: 0,
			timingStyle: Game.timingStyles.SUDDEN_DEATH,
			isOvertime: false,
			overtimeFullmove: 40,
			overtimeBonus: 600,
			isRated: true
		};
		
		for(var p in options) {
			this._options[p] = options[p];
		}
	}
	
	Challenge.prototype.getId = function() {
		return this._id;
	}
	
	Challenge.prototype.accept = function(user) {
		if(this._options.ownerPlaysAs === null) {
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
		}
		
		else {
			/*
			FIXME the value objects don't survive serialisation - the API should specify
			that the colour options are to be specified as fen strings, and then the client
			/server can serialise/deserialise them as appropriate.
			
			the below just assumes that the ownerPlaysAs option is a fen string.
			*/
			
			this._players[this._options.ownerPlaysAs] = this._owner;
			this._players[Colour.fromFenString(this._options.ownerPlaysAs).opposite] = user;
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
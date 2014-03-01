define(function(require) {
	var id = require("lib/id");
	var Piece = require("chess/Piece");
	var Chess = require("chess/Chess");
	var Event = require("lib/Event");
	var Game = require("./Game");
	var Fen = require("chess/Fen");
	var Table = require("./Table");
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		this._players = [];
		this._players[Piece.WHITE] = null;
		this._players[Piece.BLACK] = null;
		
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
	
	Challenge.prototype.toString = function() {
		return this._id;
	}
	
	Challenge.prototype.accept = function(user) {
		var success = true;
		
		if(this._options.ownerPlaysAs === null) {
			var ownerRatio = this._owner.getGamesAsWhiteRatio();
			var guestRatio = user.getGamesAsWhiteRatio();
			
			if(ownerRatio > guestRatio) {
				this._players[Piece.WHITE] = user;
				this._players[Piece.BLACK] = this._owner;
			}
			
			else {
				this._players[Piece.WHITE] = this._owner;
				this._players[Piece.BLACK] = user;
			}
		}
		
		else {
			this._players[this._options.ownerPlaysAs] = this._owner;
			this._players[Chess.getOppColour(this._options.ownerPlaysAs)] = user;
		}
		
		var table = new Table(this._owner);
		
		return success;
	}
	
	Challenge.prototype.toJSON = function() {
		return {
			id: this._id,
			owner: this._owner,
			ownerPlaysAs: this._options.ownerPlaysAs,
			startingFen: this._options.startingFen,
			clockStartDelay: this._options.clockStartDelay,
			clockStartHalfmove: this._options.clockStartHalfmove,
			initialTime: this._options.initialTime,
			timeIncrement: this._options.timeIncrement,
			timingStyle: this._options.timingStyle,
			isOvertime: this._options.isOvertime,
			overtimeFullmove: this._options.overtimeFullmove,
			overtimeBonus: this._options.overtimeBonus,
			isRated: this._options.isRated
		};
	}
	
	return Challenge;
});
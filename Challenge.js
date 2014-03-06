define(function(require) {
	var id = require("lib/id");
	var Piece = require("chess/Piece");
	var Chess = require("chess/Chess");
	var Event = require("lib/Event");
	var Game = require("./Game");
	var Fen = require("chess/Fen");
	
	function Challenge(owner, options) {
		this._id = id();
		this._owner = owner;
		this._players = [];
		this._players[Piece.WHITE] = null;
		this._players[Piece.BLACK] = null;
		
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
		
		var game = new Game(this._players[Piece.WHITE], this._players[Piece.BLACK], this._options);
		
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
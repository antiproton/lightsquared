define(function(require) {
	var ChessGame = require("chess/Game");
	var Piece = require("chess/Piece");
	var id = require("lib/id");
	var Chess = require("chess/Chess");
	var Move = require("./Move");
	
	function Game(table, white, black, options) {
		this._id = id();
		this._table = table;
		this._game = new ChessGame(options);
		
		this._players = [];
		this._players[Piece.WHITE] = white;
		this._players[Piece.BLACK] = black;
		
		this._oldRatings = [];
		this._oldRatings[Piece.WHITE] = null;
		this._oldRatings[Piece.BLACK] = null;
		
		this._newRatings = [];
		this._newRatings[Piece.WHITE] = null;
		this._newRatings[Piece.BLACK] = null;
		
		this._isUndoRequested = false;
		this._isDrawOffered = false;
		
		this._players.forEach((function(player) {
			player.subscribe("/game/" + this._id + "/move", (function(data) {
				var promoteTo = Piece.QUEEN;
				
				if(data.promoteTo !== undefined) {
					promoteTo = data.promoteTo;
				}
				
				this._move(player, data.from, data.to, promoteTo);
			}).bind(this));
			
			player.subscribe("/game/" + this._id + "/resign", (function() {
				this._resign(player);
			}).bind(this));
			
			player.subscribe("/game/" + this._id + "/offer_draw", (function() {
				this._offerDraw(player);
			}).bind(this));
		}).bind(this));
	}
	
	Game.timingStyles = ChessGame.timingStyles;
	
	Game.prototype.getId = function() {
		return this._id;
	}
	
	Game.prototype._move = function(user, from, to, promoteTo) {
		var colour = this._game.getPosition().getActiveColor();
		var oppColour = Chess.getOppColour(colour);
		
		if(this._players[colour] === user) {
			var move = this._game.move(from, to, promoteTo);
			
			if(move.isLegal()) {
				this._sendToAllUsers("/game/" + this._id + "/move", Move.fromMove(move));
			}
		}
	}
	
	Game.prototype._sendToAllUsers = function(url, data) {
		var allUsers = this._players.concat(this._table.getSpectators());
		
		allUsers.forEach(function(user) {
			user.send(url, data);
		});
	}
	
	Game.prototype.toJSON = function() {
		var options = this._game.getOptions();
		var history = [];
		
		this._game.getHistory().forEach(function(move) {
			history.push(Move.fromMove(move));
		});
		
		return {
			white: this._players[Piece.WHITE],
			black: this._players[Piece.BLACK],
			history: history,
			state: this._game.getState(),
			result: this._game.getResult(),
			resultDetails: this._game.getResultDetails(),
			startTime: this._game.getStartTime(),
			endTime: this._game.getEndTime(),
			isThreefoldClaimable: this._game.isThreefoldClaimable(),
			isFiftymoveClaimable: this._game.isFiftymoveClaimable(),
			whiteRatingOld: this._oldRatings[Piece.WHITE],
			whiteRatingNew: this._newRatings[Piece.WHITE],
			blackRatingOld: this._oldRatings[Piece.BLACK],
			blackRatingNew: this._newRatings[Piece.BLACK],
			isUndoRequested: this._isUndoRequested,
			isDrawOffered: this._isDrawOffered,
			clockStartHalfmove: options.clockStartHalfmove,
			clockStartDelay: options.clockStartDelay,
			timingStyle: options.timingStyle,
			initialTime: options.initialTime,
			increment: options.increment,
			isOvertime: options.isOvertime,
			overtimeFullmove: options.overtimeFullmove,
			overtimeBonus: options.overtimeBonus,
			isRated: options.isRated
		};
	}
	
	return Game;
});
define(function(require) {
	var ChessGame = require("chess/Game");
	var PieceType = require("chess/PieceType");
	var id = require("lib/id");
	var time = require("lib/time");
	var Colour = require("chess/Colour");
	var Move = require("jsonchess/Move");
	var Premove = require("jsonchess/Premove");
	var Square = require("chess/Square");
	var Event = require("lib/Event");
	var jsonchess = require("jsonchess/constants");
	
	function Game(white, black, options) {
		this._id = id();
		
		this.Move = new Event();
		this.GameOver = new Event();
		this.Aborted = new Event();
		this.RematchOffered = new Event();
		this.RematchDeclined = new Event();
		this.Rematch = new Event();
		this.DrawOffered = new Event();
		this.Chat = new Event();
		
		this._options = {
			history: [],
			startTime: time(),
			addedTime: null,
			initialTime: "10m",
			timeIncrement: "0"
		};
		
		if(options) {
			for(var p in options) {
				this._options[p] = options[p];
			}
		}
		
		this._addedTime = {};
		this._addedTime[Colour.white] = 0;
		this._addedTime[Colour.black] = 0;
		
		this._game = new ChessGame(this._options);
		
		this._game.GameOver.addHandler(function(result) {
			this._gameOver(result);
		}, this);
		
		if(this._options.addedTime) {
			for(var colour in this._options.addedTime) {
				this.addTime(this._options.addedTime[colour], colour);
			}
		}
		
		this._players = {};
		this._players[Colour.white] = white;
		this._players[Colour.black] = black;
		
		this._ratings = {};
		this._ratings[Colour.white] = white.getRating();
		this._ratings[Colour.black] = black.getRating();
		
		this._rematchOfferedBy = null;
		this._isUndoRequested = false;
		this._isDrawOffered = false;
		
		this._pendingPremove = null;
		
		this._isAborted = false;
		this._setAbortTimer();
	}
	
	Game.restore = function(requestA, requestB) {
		var historyA = requestA.gameDetails.history;
		var historyB = requestB.gameDetails.history;
		var minHistoryLength = Math.min(historyA.length, historyB.length);
		var commonHistory = [];
		
		for(var i = 0; i < minHistoryLength; i++) {
			if(historyA[i].label === historyB[i].label) {
				commonHistory.push(historyA[i]);
			}
			
			else {
				break;
			}
		}
		
		requestA.gameDetails.history = requestB.gameDetails.history = commonHistory;
		
		if(JSON.stringify(requestA.gameDetails) !== JSON.stringify(requestB.gameDetails)) {
			throw "Mismatch between game details submitted by each player";
		}
		
		if(requestA.colour === requestB.colour) {
			throw "Both players submitted the game to play as the same colour";
		}
		
		var gameDetails = requestA.gameDetails;
		var players = {};
		
		players[requestA.colour] = requestA.player;
		players[requestB.colour] = requestB.player;
		
		var options = gameDetails.options;
		
		options.startTime = gameDetails.startTime;
		options.addedTime = gameDetails.addedTime;
		
		options.history = gameDetails.history.map(function(move) {
			return Move.fromJSON(move);
		});
		
		var game = new Game(players[Colour.white], players[Colour.black], options);
		
		if(game.timingHasStarted() && game.getLastMove()) {
			var lastMoveTime = game.getLastMove().getTime();
			var reimbursement = time() - lastMoveTime;
			
			game.addTime(reimbursement, game.getActiveColour());
		}
		
		return game;
	}
	
	Game.prototype.getId = function() {
		return this._id;
	}
	
	Game.prototype.addTime = function(time, colour) {
		this._game.addTimeToClock(time, colour);
		this._addedTime[colour] += time;
	}
	
	Game.prototype.playerIsPlaying = function(player) {
		return (this._players[Colour.white] === player || this._players[Colour.black] === player);
	}
	
	Game.prototype.getPlayer = function(colour) {
		return this._players[colour];
	}
	
	Game.prototype.getPlayerColour = function(player) {
		var playerColour = null;
		
		Colour.forEach(function(colour) {
			if(this._players[colour] === player) {
				playerColour = colour;
			}
		}, this);
		
		return playerColour;
	}
	
	Game.prototype.isInProgress = function() {
		return this._game.isInProgress();
	}
	
	Game.prototype.timingHasStarted = function() {
		return this._game.timingHasStarted();
	}
	
	Game.prototype.getLastMove = function() {
		return this._game.getLastMove();
	}
	
	Game.prototype.getPosition = function() {
		return this._game.getPosition();
	}
	
	Game.prototype.getEndTime = function() {
		return this._game.getEndTime();
	}
	
	Game.prototype.getHistory = function() {
		return this._game.getHistory();
	}
	
	Game.prototype.getResult = function() {
		return this._game.getResult();
	}
	
	Game.prototype.chat = function(player, message) {
		this.Chat.fire({
			player: player,
			message: message
		});
	}
	
	Game.prototype.move = function(player, from, to, promoteTo) {
		if(this.getPlayerColour(player) === this.getActiveColour()) {
			var move = this._game.move(from, to, promoteTo);
			
			if(move !== null && move.isLegal()) {
				this._isDrawOffered = false;
				this._isUndoRequested = false;
				
				this.Move.fire(move);
				
				this._clearAbortTimer();
				
				if(!this._game.timingHasStarted()) {
					this._setAbortTimer();
				}
				
				if(this._pendingPremove !== null) {
					var premove = {
						from: this._pendingPremove.getFrom(),
						to: this._pendingPremove.getTo(),
						promoteTo: this._pendingPremove.getPromoteTo()
					};
					
					this._pendingPremove = null;
					this.move(this._players[this.getActiveColour()], premove.from, premove.to, premove.promoteTo);
				}
			}
		}
	}
	
	Game.prototype.premove = function(player, from, to, promoteTo) {
		var premove = new Premove(this.getPosition(), from, to, promoteTo)
		
		if(
			this.getPlayerColour(player) === this.getActiveColour().opposite
			&& premove.isValid()
			&& this._pendingPremove === null
		) {
			this._pendingPremove = premove;
		}
	}
	
	Game.prototype.getPendingPremove = function() {
		return this._pendingPremove;
	}
	
	Game.prototype.cancelPremove = function(player) {
		if(this.getPlayerColour(player) === this.getActiveColour().opposite) {
			this._pendingPremove = null;
		}
	}
	
	Game.prototype.getActiveColour = function() {
		return this._game.getActiveColour();
	}
	
	Game.prototype.resign = function(player) {
		if(this.playerIsPlaying(player)) {
			this._game.resign(this.getPlayerColour(player));
		}
	}
	
	Game.prototype.offerDraw = function(player) {
		if(this.getPlayerColour(player) === this.getActiveColour().opposite) {
			this._isDrawOffered = true;
			this.DrawOffered.fire();
		}
	}
	
	Game.prototype.acceptDraw = function(player) {
		if(this._isDrawOffered && this.getPlayerColour(player) === this.getActiveColour()) {
			this._game.drawByAgreement();
		}
	}
	
	Game.prototype.claimDraw = function(player) {
		if(this.playerIsPlaying(player)) {
			this._game.claimDraw();
		}
	}
	
	Game.prototype._rematch = function() {
		this.Rematch.fire(new Game(this._players[Colour.black], this._players[Colour.white], {
			initialTime: this._options.initialTime,
			timeIncrement: this._options.timeIncrement
		}));
	}
	
	Game.prototype.offerRematch = function(player) {
		if(this.playerIsPlaying(player)) {
			if(this._rematchOfferedBy === null) {
				this._rematchOfferedBy = player;
				this.RematchOffered.fire(player);
			}
			
			else if(this._rematchOfferedBy !== player) {
				this._rematch();
			}
		}
	}
	
	Game.prototype.declineRematch = function(player) {
		if(this.playerIsPlaying(player) && this._rematchOfferedBy !== null && this._rematchOfferedBy !== player) {
			this.RematchDeclined.fire(player);
		}
	}
	
	Game.prototype._setAbortTimer = function() {
		this._abortTimer = setTimeout((function() {
			this._abort();
		}).bind(this), jsonchess.TIME_FOR_MOVES_BEFORE_CLOCK_START);
	}
	
	Game.prototype._clearAbortTimer = function() {
		clearTimeout(this._abortTimer);
	}
	
	Game.prototype._abort = function() {
		if(this.isInProgress()) {
			this._isAborted = true;
			this.Aborted.fire();
		}
	}
	
	Game.prototype._gameOver = function(result) {
		this.GameOver.fire(result);
	}
	
	Game.prototype.toJSON = function() {
		var history = this._game.getHistory().map(function(move) {
			return Move.fromMove(move);
		});
		
		return {
			white: this._players[Colour.white],
			black: this._players[Colour.black],
			history: history,
			isInProgress: this.isInProgress(),
			result: this._game.getResult(),
			startTime: this._game.getStartTime(),
			endTime: this._game.getEndTime(),
			initialRatings: this._ratings,
			addedTime: this._addedTime,
			isUndoRequested: this._isUndoRequested,
			isDrawOffered: this._isDrawOffered,
			options: this._options,
			id: this._id
		};
	}
	
	return Game;
});
define(function(require) {
	var ChessGame = require("chess/Game");
	var PieceType = require("chess/PieceType");
	var id = require("lib/id");
	var Colour = require("chess/Colour");
	var Move = require("jsonchess/Move");
	var Square = require("chess/Square");
	var Glicko = require("chess/Glicko");
	var Event = require("lib/Event");
	var jsonchess = require("jsonchess/constants");
	require("lib/Array.remove");
	require("lib/Array.contains");
	
	function Game(white, black, options) {
		this._id = id();
		
		this.GameOver = new Event(this);
		this.Aborted = new Event(this);
		
		this._options = {
			initialTime: "10m",
			timeIncrement: "0"
		};
		
		if(options) {
			for(var p in options) {
				this._options[p] = options[p];
			}
		}
		
		this._game = new ChessGame(this._options);
		
		this._game.GameOver.addHandler(this, function(data) {
			this._gameOver(data.result);
		});
		
		this._players = {};
		this._players[Colour.white] = white;
		this._players[Colour.black] = black;
		
		this._spectators = [];
		
		this._oldRatings = {};
		this._oldRatings[Colour.white] = white.getRating();
		this._oldRatings[Colour.black] = black.getRating();
		
		this._newRatings = {};
		this._newRatings[Colour.white] = null;
		this._newRatings[Colour.black] = null;
		
		this._isUndoRequested = false;
		this._isDrawOffered = false;
		
		for(var colour in this._players) {
			this._setupPlayer(this._players[colour], colour);
		}
		
		this._isAborted = false;
		this._setAbortTimer();
	}
	
	Game.prototype.getId = function() {
		return this._id;
	}
	
	Game.prototype.spectate = function(user) {
		if(!(user in this._players) && !this._spectators.contains(user)) {
			this._spectators.push(user);
			this._setupSpectator(user);
		}
	}
	
	Game.prototype.leave = function(user) {
		this._spectators.remove(user);
	}
	
	Game.prototype.userIsPlaying = function(user) {
		return (this._players[Colour.white] === user || this._players[Colour.black] === user);
	}
	
	Game.prototype._setupPlayer = function(user, colour) {
		this._subscribeToPlayerMessages(user);
			
		user.send("/game", this);
		
		user.Replaced.addHandler(this, function(data) {
			var newUser = data.newUser;
			
			this._players[colour] = newUser;
			this._setupPlayer(newUser, colour);
		});
		
		user.LoggedOut.addHandler(this, function() {
			this._resign(user);
		});
	}
	
	Game.prototype._setupSpectator = function(user) {
		this._subscribeToUserMessages(user);
		
		user.send("/game", this);
		
		user.Replaced.addHandler(this, function(data) {
			var newUser = data.newUser;
			
			this._spectators.remove(user);
			this._spectators.push(newUser);
			this._setupSpectator(newUser);
		});
	}
	
	Game.prototype._subscribeToUserMessages = function(user) {
		user.subscribe("/game/" + this._id + "/request/moves", (function(data) {
			var index = data.startingIndex;
			
			this._game.getHistory().slice(index).forEach(function(move) {
				user.send("/game/" + this._id + "/move", this._getMoveJson(move));
			
				index++;
			});
			
		}).bind(this));
		
		user.subscribe("/game/" + this._id + "/chat", (function(message) {
			if(message.length > 0) {
				var url = "/game/" + this._id + "/chat";
				
				var chatMessage = {
					from: user.getUsername(),
					body: message
				};
				
				if(this.userIsPlaying(user) || !this._game.isInProgress()) {
					this._sendToAllUsers(url, chatMessage);
				}
				
				else {
					this._sendToSpectators(url, chatMessage);
				}
			}
		}).bind(this));
	}
	
	Game.prototype._subscribeToPlayerMessages = function(user) {
		this._subscribeToUserMessages(user);
		
		user.subscribe("/game/" + this._id + "/move", (function(data) {
			var promoteTo;
			
			if(data.promoteTo !== undefined) {
				promoteTo = PieceType.fromSanString(data.promoteTo);
			}
			
			this._move(user, Square.fromSquareNo(data.from), Square.fromSquareNo(data.to), promoteTo);
		}).bind(this));
		
		user.subscribe("/game/" + this._id + "/resign", (function() {
			this._resign(user);
		}).bind(this));
		
		user.subscribe("/game/" + this._id + "/offer_draw", (function() {
			this._offerDraw(user);
		}).bind(this));
		
		user.subscribe("/game/" + this._id + "/claim_draw", (function() {
			this._claimDraw(user);
		}).bind(this));
		
		user.subscribe("/game/" + this._id + "/accept_draw", (function() {
			this._acceptDraw(user);
		}).bind(this));
	}
	
	Game.prototype._move = function(user, from, to, promoteTo) {
		if(!this._isAborted) {
			var colour = this._game.getActiveColour();
			
			if(this._players[colour] === user) {
				var index = this._game.getHistory().length;
				var move = this._game.move(from, to, promoteTo);
				
				if(move !== null && move.isLegal()) {
					this._isDrawOffered = false;
					this._isUndoRequested = false;
					this._sendToAllUsers("/game/" + this._id + "/move", this._getMoveJson(move, index));
					
					this._clearAbortTimer();
					
					if(!this._game.timingHasStarted()) {
						this._setAbortTimer();
					}
				}
			}
		}
	}
	
	Game.prototype._getMoveJson = function(move, index) {
		var promoteTo = move.getPromoteTo();
		
		return {
			from: move.getFrom().squareNo,
			to: move.getTo().squareNo,
			promoteTo: promoteTo === PieceType.queen ? undefined : promoteTo.sanString,
			index: index,
			time: move.getTime()
		};
	}
	
	Game.prototype._resign = function(user) {
		if(!this._isAborted) {
			var playerColour = this._getPlayerColour(user);
			
			if(playerColour !== null) {
				this._game.resign(playerColour);
			}
		}
	}
	
	Game.prototype._offerDraw = function(user) {
		if(!this._isAborted) {
			var playerColour = this._getPlayerColour(user);
			
			if(playerColour === this._game.getActiveColour().opposite) {
				this._isDrawOffered = true;
				this._sendToAllUsers("/game/" + this._id + "/draw_offer", playerColour.fenString);
			}
		}
	}
	
	Game.prototype._claimDraw = function(user) {
		if(!this._isAborted) {
			if(this.userIsPlaying(user)) {
				this._game.claimDraw();
			}
		}
	}
	
	Game.prototype._acceptDraw = function(user) {
		if(!this._isAborted) {
			if(this._getPlayerColour(user) === this._game.getActiveColour() && this._isDrawOffered) {
				this._game.drawByAgreement();
			}
		}
	}
	
	Game.prototype._sendToAllUsers = function(url, data) {
		var users = [];
		
		for(var colour in this._players) {
			users.push(this._players[colour]);
		}
		
		users = users.concat(this._spectators);
		
		users.forEach(function(user) {
			user.send(url, data);
		});
	}
	
	Game.prototype._sendToSpectators = function(url, data) {
		this._spectators.forEach(function(user) {
			user.send(url, data);
		});
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
		this._isAborted = true;
		this.Aborted.fire();
		this._sendToAllUsers("/game/" + this._id + "/aborted");
	}
	
	Game.prototype._gameOver = function(result) {
		var newRatings = Glicko.getNewRatings(this._players, result);
		
		Colour.forEach(function(colour) {
			this._players[colour].updateRating(newRatings[colour]);
		}, this);
		
		this._sendToAllUsers("/game/" + this._id + "/game_over", {
			result: result
		});
		
		this.GameOver.fire({
			result: result
		});
	}
	
	Game.prototype._getPlayerColour = function(user) {
		var playerColour = null;
		
		Colour.forEach(function(colour) {
			if(this._players[colour] === user) {
				playerColour = colour;
			}
		}, this);
		
		return playerColour;
	}
	
	Game.prototype.toJSON = function() {
		var history = this._game.getHistory().map(function(move) {
			return Move.fromMove(move);
		});
		
		return {
			white: this._players[Colour.white],
			black: this._players[Colour.black],
			history: history,
			isInProgress: this._game.isInProgress(),
			result: this._game.getResult(),
			startTime: this._game.getStartTime(),
			endTime: this._game.getEndTime(),
			isThreefoldClaimable: this._game.isThreefoldClaimable(),
			isFiftymoveClaimable: this._game.isFiftymoveClaimable(),
			whiteRatingOld: this._oldRatings[Colour.white],
			whiteRatingNew: this._newRatings[Colour.white],
			blackRatingOld: this._oldRatings[Colour.black],
			blackRatingNew: this._newRatings[Colour.black],
			isUndoRequested: this._isUndoRequested,
			isDrawOffered: this._isDrawOffered,
			options: this._options,
			id: this._id
		};
	}
	
	return Game;
});
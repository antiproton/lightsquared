define(function(require) {
	var ChessGame = require("chess/Game");
	var PieceType = require("chess/PieceType");
	var id = require("lib/id");
	var time = require("lib/time");
	var Publisher = require("lib/Publisher");
	var Colour = require("chess/Colour");
	var Move = require("jsonchess/Move");
	var Premove = require("jsonchess/Premove");
	var Square = require("chess/Square");
	var Event = require("lib/Event");
	var jsonchess = require("jsonchess/constants");
	require("lib/Array.remove");
	require("lib/Array.contains");
	
	function Game(white, black, options) {
		this._id = id();
		
		this.Move = new Event(this);
		this.GameOver = new Event(this);
		this.Aborted = new Event(this);
		this.Rematch = new Event(this);
		
		this._options = {
			history: [],
			startTime: time(),
			initialTime: "10m",
			timeIncrement: "0"
		};
		
		if(options) {
			for(var p in options) {
				this._options[p] = options[p];
			}
		}
		
		this._game = new ChessGame(this._options);
		
		this._game.GameOver.addHandler(this, function(result) {
			this._gameOver(result);
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
		this._rematchOfferedBy = null;
		
		this._pendingPremove = null;
		
		for(var colour in this._players) {
			this._setupPlayer(this._players[colour], colour);
		}
		
		this._isAborted = false;
		this._setAbortTimer();
	}
	
	Game.restore = function(users, userAGameDetails, userBGameDetails) {
		var historyA = userAGameDetails.history;
		var historyB = userBGameDetails.history;
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
		
		userAGameDetails.history = userBGameDetails.history = commonHistory;
		
		if(JSON.stringify(userAGameDetails) !== JSON.stringify(userBGameDetails)) {
			throw "Mismatch between game details submitted by each player";
		}
		
		if(!userAGameDetails.isInProgress) {
			throw "Game must be in progress to be restored";
		}
		
		var gameDetails = userAGameDetails;
		var white = users[gameDetails.white.username];
		var black = users[gameDetails.black.username];
		var options = gameDetails.options;
		
		options.startTime = gameDetails.startTime;
		
		options.history = gameDetails.history.map(function(move) {
			return Move.fromJSON(move);
		});
		
		var game = new Game(white, black, options);
		
		if(game.timingHasStarted() && game.getLastMove()) {
			var lastMoveTime = game.getLastMove().getTime();
			var reimbursement = time() - lastMoveTime;
			
			game.addTimeToClock(reimbursement);
		}
		
		return game;
	}
	
	Game.prototype.getId = function() {
		return this._id;
	}
	
	Game.prototype.spectate = function(user) {
		if(!this.userIsPlaying(user) && !this._spectators.contains(user)) {
			this._spectators.push(user);
			this._setupSpectator(user);
		}
	}
	
	Game.prototype.addTimeToClock = function(time) {
		this._game.addTimeToClock(time);
	}
	
	Game.prototype.leave = function(user) {
		this._spectators.remove(user);
	}
	
	Game.prototype.userIsPlaying = function(user) {
		return (this._players[Colour.white] === user || this._players[Colour.black] === user);
	}
	
	Game.prototype.getPlayer = function(colour) {
		return this._players[colour];
	}
	
	Game.prototype.getPlayerColour = function(user) {
		var playerColour = null;
		
		Colour.forEach(function(colour) {
			if(this._players[colour] === user) {
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
	
	Game.prototype.getResult = function() {
		return this._game.getResult();
	}
	
	Game.prototype._setupPlayer = function(user, colour) {
		this._subscribeToPlayerMessages(user);
		
		user.Replaced.addHandler(this, function(newUser) {
			this._players[colour] = newUser;
			this._setupPlayer(newUser, colour);
			
			newUser.send("/game", this);
			
			this.spectate(user);
		});
		
		user.LoggingOut.addHandler(this, function() {
			this._resign(user);
		});
	}
	
	Game.prototype._setupSpectator = function(user) {
		this._subscribeToUserMessages(user);
		
		user.Replaced.addHandler(this, function(newUser) {
			this._spectators.remove(user);
			this._spectators.push(newUser);
			this._setupSpectator(newUser);
			
			newUser.send("/game", this);
		});
	}
	
	Game.prototype._subscribeToUserMessages = function(user) {
		user.subscribe("/game/" + this._id + "/request/moves", (function(startingIndex) {
			var index = startingIndex;
			
			this._game.getHistory().slice(index).forEach(function(move) {
				user.send("/game/" + this._id + "/move", this._getMoveJson(move, index));
			
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
				
				if(this.userIsPlaying(user) || !this.isInProgress()) {
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
		
		var publisher = new Publisher(user);
		
		var isInProgress = (function() {
			return (!this._isAborted && this._game.isInProgress());
		}).bind(this);
		
		var userIsActivePlayer = (function(user) {
			return (isInProgress() && this.getPlayerColour(user) === this.getActiveColour());
		}).bind(this);
		
		var userIsInactivePlayer = (function(user) {
			return (isInProgress() && this.getPlayerColour(user) === this.getActiveColour().opposite);
		}).bind(this);
		
		var isActiveAndUserIsPlaying = (function(user) {
			return (isInProgress() && this.userIsPlaying(user));
		}).bind(this);
		
		var filters = {
			"/move": userIsActivePlayer,
			"/premove/cancel": userIsInactivePlayer,
			"/resign": isActiveAndUserIsPlaying,
			"/offer_draw": userIsInactivePlayer,
			"/accept_draw": userIsActivePlayer,
			"/claim_draw": isActiveAndUserIsPlaying,
			"/offer_or_accept_rematch": this.userIsPlaying.bind(this),
			"/decline_rematch": this.userIsPlaying.bind(this),
		};
		
		for(var url in filters) {
			filters["/game/" + this._id + url] = filters[url];
			
			delete filters[url];
		}
		
		user.subscribe("*", (function(url, data) {
			if(!(url in filters) || filters[url](user)) {
				publisher.publish(url, data);
			}
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/move", (function(data) {
			var promoteTo;
			
			if(data.promoteTo !== undefined) {
				promoteTo = PieceType.fromSanString(data.promoteTo);
			}
			
			this.move(user, Square.fromSquareNo(data.from), Square.fromSquareNo(data.to), promoteTo);
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/premove", (function(json) {
			if(this._pendingPremove === null) {
				var premove = Premove.fromJSON(json, this.getPosition());
				
				if(premove.isValid()) {
					this._pendingPremove = premove;
				}
			}
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/premove/cancel", (function() {
			this._pendingPremove = null;
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/resign", (function() {
			this._resign(user);
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/offer_draw", (function() {
			this._offerDraw(user);
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/claim_draw", (function() {
			this._claimDraw();
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/accept_draw", (function() {
			this._acceptDraw();
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/offer_or_accept_rematch", (function() {
			this._offerOrAcceptRematch(user);
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/decline_rematch", (function() {
			this._declineRematch(user);
		}).bind(this));
		
		publisher.subscribe("/game/" + this._id + "/request/premove", (function() {
			if(this.getPlayerColour(user) === this.getActiveColour().opposite) {
				user.send("/premove", this._pendingPremove);
			}
		}).bind(this));
	}
	
	Game.prototype.move = function(user, from, to, promoteTo) {
		if(this.getPlayerColour(user) === this.getActiveColour()) {
			var index = this._game.getHistory().length;
			var move = this._game.move(from, to, promoteTo);
			
			if(move !== null && move.isLegal()) {
				this._isDrawOffered = false;
				this._isUndoRequested = false;
				this._sendToAllUsers("/game/" + this._id + "/move", this._getMoveJson(move, index));
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
	
	Game.prototype.getActiveColour = function() {
		return this._game.getActiveColour();
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
		this._game.resign(this.getPlayerColour(user));
	}
	
	Game.prototype._offerDraw = function(user) {
		this._isDrawOffered = true;
		this._sendToAllUsers("/game/" + this._id + "/draw_offer", this.getPlayerColour(user).fenString);
	}
	
	Game.prototype._offerOrAcceptRematch = function(user) {
		var colour = this.getPlayerColour(user);

		if(this._rematchOfferedBy === colour.opposite) {
			this._rematch();
		}
		
		else if(this._rematchOfferedBy === null) {
			this._rematchOfferedBy = colour;
			this._players[colour.opposite].send("/game/" + this._id + "/rematch_offer");
		}
	}
	
	Game.prototype._declineRematch = function(user) {
		var colour = this.getPlayerColour(user);
		
		if(this._rematchOfferedBy === colour.opposite) {
			this._players[colour.opposite].send("/game/" + this._id + "/rematch_declined");
		}
	}
	
	Game.prototype._rematch = function() {
		var game = new Game(this._players[Colour.black], this._players[Colour.white], this._options);
		
		this.Rematch.fire(game);
		this._sendToAllUsers("/game/" + this._id + "/rematch", game);
	}
	
	Game.prototype._claimDraw = function() {
		this._game.claimDraw();
	}
	
	Game.prototype._acceptDraw = function() {
		if(this._isDrawOffered) {
			this._game.drawByAgreement();
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
		if(this.isInProgress()) {
			this._isAborted = true;
			this.Aborted.fire();
			this._sendToAllUsers("/game/" + this._id + "/aborted");
		}
	}
	
	Game.prototype._gameOver = function(result) {
		this._sendToAllUsers("/game/" + this._id + "/game_over", {
			result: result
		});
		
		this.GameOver.fire();
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
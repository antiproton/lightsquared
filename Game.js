define(function(require) {
	var ChessGame = require("chess/Game");
	var PieceType = require("chess/PieceType");
	var id = require("lib/id");
	var Colour = require("chess/Colour");
	var Move = require("common/Move");
	var Square = require("chess/Square");
	
	function Game(white, black, options) {
		this._id = id();
		this._options = options;
		this._game = new ChessGame(this._options);
		
		this._game.GameOver.addHandler(this, function(data) {
			this._gameOver(data.result);
		});
		
		this._players = {};
		this._players[Colour.white] = white;
		this._players[Colour.black] = black;
		
		this._spectators = [];
		
		this._oldRatings = {};
		this._oldRatings[Colour.white] = null;
		this._oldRatings[Colour.black] = null;
		
		this._newRatings = {};
		this._newRatings[Colour.white] = null;
		this._newRatings[Colour.black] = null;
		
		this._isUndoRequested = false;
		this._isDrawOffered = false;
		
		for(var colour in this._players) {
			this._setupPlayer(this._players[colour], colour);
		}
	}
	
	Game.prototype.getId = function() {
		return this._id;
	}
	
	Game.prototype._setupPlayer = function(user, colour) {
		this._subscribeToPlayerMessages(user);
			
		user.send("/game/new", this);
		
		user.Replaced.addHandler(this, function(data) {
			var newUser = data.newUser;
			
			this._players[colour] = newUser;
			
			this._setupPlayer(newUser, colour);
		});
	}
	
	Game.prototype._subscribeToPlayerMessages = function(user) {
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
	}
	
	Game.prototype._move = function(user, from, to, promoteTo) {
		var colour = this._game.getPosition().getActiveColour();
		
		if(this._players[colour] === user) {
			var index = this._game.getHistory().length;
			var move = this._game.move(from, to, promoteTo);
			
			if(move.isLegal()) {
				this._sendToAllUsers("/game/" + this._id + "/move", {
					from: from.squareNo,
					to: to.squareNo,
					promoteTo: (promoteTo ? promoteTo.sanString : undefined),
					index: index
				});
			}
		}
	}
	
	Game.prototype._resign = function(user) {
		var playerColour = null;
		
		this._players.forEach(function(player, colour) {
			if(player === user) {
				playerColour = colour;
			}
		});
		
		if(playerColour !== null) {
			this._game.resign(playerColour);
			
			this._sendToAllUsers("/game/" + this._id + "/resignation", {
				colour: playerColour
			});
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
	
	Game.prototype.toJSON = function() {
		var history = [];
		
		this._game.getHistory().forEach(function(move) {
			history.push(Move.fromMove(move));
		});
		
		return {
			white: this._players[Colour.white],
			black: this._players[Colour.black],
			history: history,
			state: this._game.getState(),
			result: this._game.getResult(),
			resultType: this._game.getResultType(),
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
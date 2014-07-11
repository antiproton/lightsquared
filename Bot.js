define(function(require) {
	require("lib/Array.random");
	var spawn = require("child_process").spawn;
	var PieceType = require("chess/PieceType");
	var id = require("lib/id");
	var Event = require("lib/Event");
	var Square = require("chess/Square");
	
	function Bot(app) {
		this._id = id();
		this._username = this._id;
		this._gamesPlayedAsWhite = 0;
		this._gamesPlayedAsBlack = 0;
		
		this._isLoggedIn = true;
		this._app = app;
		this._game = null;
		this._challenge = null;
		this._uciSkillLevel = 5 + Math.floor(Math.random() * 10);
		this._rating = 123; //set this depending on the skill level
		
		var acceptChallenge = (function() {
			if(!this._game) {
				this._app.getOpenChallenges().some((function(challenge) {
					var game = challenge.accept(this);
					
					if(game) {
						this._playGame(game);
					}
				}).bind(this));
			}
		}).bind(this);
		
		var createChallenge = (function() {
			if(!this._challenge && !this._game) {
				this._challenge = this._app.createChallenge(this, {
					initialTime: ["1", "2", "3", "5", "10", "15", "20", "30"].random(),
					timeIncrement: ["0", "1", "2", "5", "10"].random()
				});
				
				this._challenge.Accepted.addHandler(this, function(game) {
					this._playGame(game);
				});
				
				this._challenge.Expired.addHandler(this, function() {
					this._challenge = null;
				});
			}
		}).bind(this);
		
		var findGame = [acceptChallenge, createChallenge].random();
		
		setInterval(findGame, 1000 + Math.floor(Math.random() * 5000));
	}
	
	Bot.prototype.getGamesAsWhiteRatio = function() {
		return Math.max(1, this._gamesPlayedAsWhite) / Math.max(1, this._gamesPlayedAsBlack);
	}
	
	Bot.prototype.getRating = function() {
		return this._rating;
	}
	
	Bot.prototype.getName = function() {
		return this._username;
	}
	
	Bot.prototype._playGame = function(game) {
		this._game = game;
		
		var colour = game.getPlayerColour(this);
		
		var move = (function() {
			if(game.getActiveColour() === colour) {
				setTimeout((function() {
					var fen = game.getPosition().getFen();
					var stockfish = spawn("stockfish");
					
					stockfish.stdin.write("position fen " + fen + "\n");
					stockfish.stdin.write("go movetime 60\n");
					
					stockfish.stdout.on("data", (function(chunk) {
						var bestmoveLine = "bestmove ";
						var output = chunk.toString();
						
						if(output.indexOf(bestmoveLine) !== -1) {
							stockfish.stdin.end();
							
							var bestmove = output.substr(output.indexOf(bestmoveLine) + bestmoveLine.length, 4); //e.g. e2e4
							var from = Square.fromAlgebraic(bestmove.substr(0, 2));
							var to = Square.fromAlgebraic(bestmove.substr(2));
							var promoteTo;
							
							if(bestmove.length === 5) {
								promoteTo = PieceType.fromSanString(bestmove.substr(4).toUpperCase());
							}
							
							game.move(this, from, to, promoteTo);
						}
					}).bind(this));
				}).bind(this), Math.floor(Math.random() * 3000));
			}
		}).bind(this);
		
		move();
		
		game.Move.addHandler(this, move);
		
		game.GameOver.addHandler(this, function() {
			this._game = null;
		});
		
		game.Aborted.addHandler(this, function() {
			this._game = null;
		});
	}
	
	Bot.prototype.toJSON = function() {
		return {
			id: this._id,
			username: this._username,
			isLoggedIn: true,
			rating: this._rating
		};
	}
	
	return Bot;
});
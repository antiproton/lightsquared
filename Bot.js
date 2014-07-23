define(function(require) {
	require("lib/Array.random");
	var spawn = require("child_process").spawn;
	var PieceType = require("chess/PieceType");
	var id = require("lib/id");
	var Event = require("lib/Event");
	var Square = require("chess/Square");
	var glicko2Constants = require("jsonchess/glicko2");
	var Colour = require("chess/Colour");
	
	var names = [
		"Norm",
		"Steel",
		"timh",
		"blackrabbit",
		"shevek"
	];
	
	var botNo = 0;
	
	var createChallenge = function() {
		if(!this._challenge && !this._game) {
			this._challenge = this._app.createChallenge(this, {
				initialTime: ["1", "2", "3", "5", "10", "15", "20", "30"].random(),
				timeIncrement: ["0", "1", "2", "5", "10"].random()
			});
			
			this._challenge.Accepted.addHandler(function(game) {
				this._playGame(game);
			}, this);
			
			this._challenge.Expired.addHandler(function() {
				this._challenge = null;
			}, this);
		}
	};
	
	var acceptChallenge = function() {
		if(!this._game) {
			this._app.getOpenChallenges().some((function(challenge) {
				var game = challenge.accept(this);
				
				if(game) {
					this._playGame(game);
				}
			}).bind(this));
		}
	};
	
	function Bot(app, seekStrategy) {
		seekStrategy = seekStrategy || Bot.seekStrategies.RANDOM;
		
		this._id = id();
		this._name = names.pop() || "Stockfish " + ++botNo;
		
		this._gamesPlayedAs = {};
		this._gamesPlayedAs[Colour.white] = 0;
		this._gamesPlayedAs[Colour.black] = 0;
		
		this._app = app;
		this._game = null;
		this._challenge = null;
		this._uciSkillLevel = 5;
		this._rating = Math.round(1400 + Math.random() * 200);
		
		this._glicko2 = {
			rating: this._rating,
			rd: glicko2Constants.defaults.RD,
			vol: glicko2Constants.defaults.VOL
		};
		
		setInterval(seekStrategy().bind(this), 1000 + Math.floor(Math.random() * 5000));
	}
	
	Bot.seekStrategies = {
		ACCEPT: function() {
			return acceptChallenge;
		},
		CREATE: function() {
			return createChallenge;
		},
		RANDOM: function() {
			return [acceptChallenge, createChallenge].random();
		}
	};
	
	Bot.prototype.getGamesAsWhiteRatio = function() {
		return Math.max(1, this._gamesPlayedAs[Colour.white]) / Math.max(1, this._gamesPlayedAs[Colour.black]);
	}
	
	Bot.prototype.getRating = function() {
		return this._rating;
	}
	
	Bot.prototype.getGlicko2 = function() {
		return this._glicko2;
	}
	
	Bot.prototype.getName = function() {
		return this._name;
	}
	
	Bot.prototype._playGame = function(game) {
		this._game = game;
		
		var colour = game.getPlayerColour(this);
		
		var move = (function() {
			if(game.getActiveColour() === colour) {
				setTimeout((function() {
					var fen = game.getPosition().getFen();
					var stockfish = spawn("stockfish");
					
					stockfish.stdin.write("uci\n");
					stockfish.stdin.write("ucinewgame\n");
					stockfish.stdin.write("setoption Skill Level value " + this._uciSkillLevel + "\n");
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
		
		game.Move.addHandler(move);
		
		game.GameOver.addHandler(function() {
			this._game = null;
			this._gamesPlayedAs[game.getPlayerColour(this)]++;
			
			if(Math.random() > 0.5) {
				setTimeout((function() {
					game.offerRematch(this);
				}).bind(this), 345);
			}
		}, this);
		
		game.RematchOffered.addHandler(function(player) {
			if(player !== this) {
				setTimeout((function() {
					game.offerRematch(this);
				}).bind(this), 123);
			}
		}, this);
		
		game.Aborted.addHandler(function() {
			this._game = null;
		}, this);
		
		game.Rematch.addHandler(function(game) {
			this._playGame(game);
		}, this);
	}
	
	Bot.prototype.toJSON = function() {
		return {
			id: this._id,
			name: this._name,
			rating: this._rating
		};
	}
	
	return Bot;
});
define(function(require) {
	require("lib/Array.random");
	var spawn = require("child_process").spawn;
	var PieceType = require("chess/PieceType");
	var Glicko2 = require("glicko2").Glicko2;
	var glicko2Constants = require("jsonchess/glicko2");
	var id = require("lib/id");
	var Event = require("lib/Event");
	var Square = require("chess/Square");
	
	function Bot(app) {
		this._id = id();
		this._username = this._id;
		this._gamesPlayedAsWhite = 0;
		this._gamesPlayedAsBlack = 0;
		this._recentRatedResults = [];
		this._isLoggedIn = true;
		this._app = app;
		this._game = null;
		this._challenge = null;
		this._uciSkillLevel = 5 + Math.floor(Math.random() * 10);
		this._glicko2 = this._getInitialGlicko2();
		
		this.Connected = new Event(this);
		this.Disconnected = new Event(this);
		this.LoggedIn = new Event(this);
		this.LoggingOut = new Event(this);
		this.LoggedOut = new Event(this);
		this.Replaced = new Event(this);
		
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
		return this._glicko2.rating;
	}
	
	Bot.prototype.getGlicko2 = function() {
		return this._glicko2;
	}
	
	Bot.prototype._registerCompletedRatedGame = function(game) {
		var colour = game.getPlayerColour(this);
		var opponentGlicko2 = game.getPlayer(colour.opposite).getGlicko2();
		var result = game.getResult();
		
		this._recentRatedResults.push({
			opponentGlicko2: {
				rating: opponentGlicko2.rating,
				rd: opponentGlicko2.rd,
				vol: opponentGlicko2.vol
			},
			playerScore: result.scores[colour]
		});
		
		if(this._recentRatedResults.length === glicko2Constants.GAMES_PER_RATING_PERIOD) {
			this._updateGlicko2();
			this._recentRatedResults = [];
		}
	}
	
	Bot.prototype._updateGlicko2 = function() {
		var glicko2 = new Glicko2({
			rating: glicko2Constants.defaults.RATING,
			rd: glicko2Constants.defaults.RD,
			vol: glicko2Constants.defaults.VOL
		});
		
		var matches = [];
		var glicko2Player = glicko2.makePlayer(this._glicko2.rating, this._glicko2.rd, this._glicko2.vol);
		
		this._recentRatedResults.forEach(function(result) {
			var opponentGlicko2 = result.opponentGlicko2;
			var glicko2Opponent = glicko2.makePlayer(opponentGlicko2.rating, opponentGlicko2.rd, opponentGlicko2.vol);
			
			matches.push([glicko2Player, glicko2Opponent, result.playerScore]);
		});
		
		glicko2.updateRatings(matches);
		
		this._glicko2 = {
			rating: glicko2Player.getRating(),
			rd: glicko2Player.getRd(),
			vol: glicko2Player.getVol()
		};
	}
	
	Bot.prototype._getInitialGlicko2 = function() {
		return {
			rating: glicko2Constants.defaults.RATING,
			rd: glicko2Constants.defaults.RD,
			vol: glicko2Constants.defaults.VOL
		};
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
					stockfish.stdin.write("go movetime 1000\n");
					
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
			this._registerCompletedRatedGame(game);
		});
		
		game.Aborted.addHandler(this, function() {
			this._game = null;
		});
	}
	
	Bot.prototype.send = function(url, data) {
		/*
		bots deal directly with the app
		*/
	}
	
	Bot.prototype.subscribe = function(url, callback) {
		/*
		bots deal directly with the app
		*/
	}
	
	Bot.prototype.toJSON = function() {
		return {
			id: this._id,
			username: this._username,
			isLoggedIn: this._isLoggedIn,
			gamesPlayedAsWhite: this._gamesPlayedAsWhite,
			gamesPlayedAsBlack: this._gamesPlayedAsBlack,
			rating: this._glicko2.rating
		};
	}
	
	return Bot;
});
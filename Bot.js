define(function(require) {
	require("Array.prototype/random");
	var spawn = require("child_process").spawn;
	var id = require("js/id");
	var Event = require("js/Event");
	var time = require("js/time");
	var glicko2Constants = require("jsonchess/glicko2");
	var PieceType = require("chess/PieceType");
	var Square = require("chess/Square");
	var Colour = require("chess/Colour");
	var Time = require("chess/Time");
	
	var botNo = 0;
	
	var createSeek = function() {
		if(!this._seek && !this._game) {
			this._seek = this._app.createSeek(this, {
				initialTime: Time.fromUnitString(["30s", "45s", "1m30", "10"].random(), Time.minutes) + 0,
				timeIncrement: Time.fromUnitString(["0", "1", "5", "15"].random(), Time.seconds) + 0
			});
			
			this._seek.Matched.addHandler(function(game) {
				this._playGame(game);
				this._seek = null;
			}, this);
			
			this._seek.Expired.addHandler(function() {
				this._seek = null;
				this._seekFunction();
			}, this);
		}
	};
	
	var acceptSeek = function() {
		if(!this._game) {
			this._app.getOpenSeeks().some((function(seek) {
				var game = seek.accept(this);
				
				if(game) {
					this._playGame(game);
					
					return true;
				}
			}).bind(this));
		}
	};
	
	function Bot(app) {
		this._id = id();
		this._name = "Stockfish " + ++botNo;
		
		this.Disconnected = new Event(this);
		this.Connected = new Event(this);
		
		this._gamesPlayedAs = {};
		this._gamesPlayedAs[Colour.white] = 0;
		this._gamesPlayedAs[Colour.black] = 0;
		
		this._app = app;
		this._game = null;
		this._rematchTimer = null;
		this._seek = null;
		this._uciSkillLevel = 5;
		this._rating = Math.round(1450 + Math.random() * 100);
		
		this._glicko2 = {
			rating: this._rating,
			rd: glicko2Constants.defaults.RD,
			vol: glicko2Constants.defaults.VOL
		};
		
		var stockfish = this._engine = spawn("stockfish");
		
		var commands = [
			"uci",
			"setoption name Skill Level value " + this._uciSkillLevel
		];
		
		commands.forEach(function(command) {
			stockfish.stdin.write(command + "\n");
		});
		
		var applyMove = (function(move) {
			this._game.move(
				this,
				Square.byAlgebraic[move[1]],
				Square.byAlgebraic[move[2]],
				move[3] ? PieceType.bySanString[move[3].toUpperCase()] : PieceType.queen
			);
		}).bind(this);
		
		stockfish.stdout.on("data", (function(chunk) {
			var move = chunk.toString().match(/bestmove (\w\d)(\w\d)(\w?)/);
			
			if(move && this._game) {
				var lastMove = this._game.getLastMove();
				var startOrLastMoveTime = (lastMove ? lastMove.time : this._game.getStartTime());
				var timeSinceLastMove = time() - startOrLastMoveTime;
				
				if(timeSinceLastMove < Bot.MIN_MOVE_TIME) {
					setTimeout(function() {
						applyMove(move);
					}, Bot.MIN_MOVE_TIME - timeSinceLastMove);
				}
				
				else {
					applyMove(move);
				}
			}
		}).bind(this));
		
		this._seekFunction = [acceptSeek, createSeek][botNo % 2].bind(this);
		
		setInterval(this._seekFunction, 1000 + Math.floor(Math.random() * 5000));
	}
	
	Bot.MIN_MOVE_TIME = 200; //stop crazily fast end games
	
	Bot.seekStrategies = {
		ACCEPT: function() {
			return acceptSeek;
		},
		CREATE: function() {
			return createSeek;
		},
		RANDOM: function() {
			return [acceptSeek, createSeek].random();
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
	
	Bot.prototype.isUser = function() {
		return false;
	}
	
	Bot.prototype._playGame = function(game) {
		this._clearRematchTimer();
		this._game = game;
		this._engine.stdin.write("ucinewgame\n");
		
		game.Move.addHandler((function() {
			this._move();
			this._claimDraw();
		}).bind(this));
		
		game.GameOver.addHandler(function() {
			setTimeout((function() {
				this._offerRematch();
			}).bind(this), 500);
			
			this._gamesPlayedAs[game.getPlayerColour(this)]++;
		}, this);
		
		game.Aborted.addHandler(function() {
			this._offerRematch();
		}, this);
		
		game.Rematch.addHandler(function(game) {
			this._playGame(game);
			this._clearRematchTimer();
		}, this);
		
		this._move();
	}
	
	Bot.prototype._move = function() {
		var game = this._game;
		
		if(game && game.isInProgress() && game.getActiveColour() === game.getPlayerColour(this)) {
			var moves = game.getHistory().map(function(move) {
				return move.uciLabel;
			}).join(" ");
			
			var botTimeBuffer = 1000; //stop bots running out of time due to lag
			var artificialMaxBotTime = 1000 * 30; //stop bots thinking too deeply
			var times = {};
			
			Colour.forEach(function(colour) {
				times[colour] = game.getTimeLeft(colour);
				times[colour] -= Math.min(botTimeBuffer, times[colour] - 1); //make them think they have slightly less time, down to 1ms
				times[colour] = Math.min(times[colour], artificialMaxBotTime);
			});
			
			this._engine.stdin.write("position startpos" + (moves ? " moves " + moves : "") + "\n");
			this._engine.stdin.write("go wtime " + times[Colour.white]	+ " btime " + times[Colour.black] + " winc 0 binc 0\n");
		}
	}
	
	Bot.prototype._claimDraw = function() {
		if(this._game) {
			this._game.claimDraw(this);
		}
	}
	
	Bot.prototype._offerRematch = function() {
		var game = this._game;
		
		this._game.offerRematch(this);
		
		this._rematchTimer = setTimeout((function() {
			if(this._game === game) {
				game.cancelRematchOffer(this);
				
				this._game = null;
			}
		}).bind(this), 1000 * 10);
	}
	
	Bot.prototype._clearRematchTimer = function() {
		if(this._rematchTimer) {
			clearTimeout(this._rematchTimer);
			
			this._rematchTimer = null;
		}
	}
	
	Bot.prototype.toJSON = function() {
		return {
			id: this._id,
			name: this._name,
			rating: this._rating,
			isUser: false
		};
	}
	
	return Bot;
});
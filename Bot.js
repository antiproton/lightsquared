define(function(require) {
	require("lib/Array.random");
	var spawn = require("child_process").spawn;
	var PieceType = require("chess/PieceType");
	var id = require("lib/id");
	var Event = require("lib/Event");
	var Square = require("chess/Square");
	var glicko2Constants = require("jsonchess/glicko2");
	var Colour = require("chess/Colour");
	
	var botNo = 0;
	
	var createSeek = function() {
		if(!this._seek && !this._game) {
			this._seek = this._app.createSeek(this, {
				initialTime: ["30s", "45s", "1m30"].random(),
				timeIncrement: ["0", "1"].random()
			});
			
			this._seek.Matched.addHandler(function(game) {
				this._playGame(game);
			}, this);
			
			this._seek.Expired.addHandler(function() {
				this._seek = null;
			}, this);
		}
	};
	
	var acceptSeek = function() {
		if(!this._game) {
			this._app.getOpenSeeks().some((function(seek) {
				var game = seek.accept(this);
				
				if(game) {
					this._playGame(game);
				}
			}).bind(this));
		}
	};
	
	function Bot(app, seekStrategy) {
		seekStrategy = seekStrategy || Bot.seekStrategies.RANDOM;
		
		this._id = id();
		this._name = "Stockfish " + ++botNo;
		
		this.Disconnected = new Event(this);
		this.Connected = new Event(this);
		
		this._gamesPlayedAs = {};
		this._gamesPlayedAs[Colour.white] = 0;
		this._gamesPlayedAs[Colour.black] = 0;
		
		this._app = app;
		this._game = null;
		this._seek = null;
		this._uciSkillLevel = 5;
		this._rating = Math.round(1400 + Math.random() * 200);
		
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
		
		stockfish.stdout.on("data", (function(chunk) {
			var move = chunk.toString().match(/bestmove (\w\d)(\w\d)(\w?)/);
			
			if(move && this._game) {
				this._game.move(
					this,
					Square.fromAlgebraic(move[1]),
					Square.fromAlgebraic(move[2]),
					move[3] ? PieceType.fromSanString(move[3].toUpperCase()) : PieceType.queen
				);
			}
		}).bind(this));
		
		setInterval(seekStrategy().bind(this), 1000 + Math.floor(Math.random() * 5000));
	}
	
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
	
	Bot.prototype._playGame = function(game) {
		this._game = game;
		this._engine.stdin.write("ucinewgame\n");
		this._move();
		
		game.Move.addHandler((function() {
			this._move();
		}).bind(this));
		
		game.GameOver.addHandler(function() {
			setTimeout((function() {
				this._game = null
			}).bind(this), 1000 * 30);
			
			this._gamesPlayedAs[game.getPlayerColour(this)]++;
			
			setTimeout((function() {
				game.offerRematch(this);
			}).bind(this), 1000);
		}, this);
		
		game.Aborted.addHandler(function() {
			this._game = null;
		}, this);
		
		game.Rematch.addHandler(function(game) {
			this._playGame(game);
		}, this);
	}
	
	Bot.prototype._move = function() {
		var game = this._game;
		
		if(game && game.isInProgress() && game.getActiveColour() === game.getPlayerColour(this)) {
			var moves = game.getHistory().map(function(move) {
				return move.getUciLabel();
			}).join(" ");
			
			var botTimeBuffer = 1000; //stop bots running out of time due to lag
			var artificialMaxBotTime = 1000 * 30; //stop bots thinking too deeply
			var times = {};
			
			Colour.forEach(function(colour) {
				times[colour] = game.getTimeLeft(Colour.white).getMilliseconds();
				times[colour] -= Math.min(botTimeBuffer, times[colour] - 1); //make them think they have slightly less time, down to 1ms
				times[colour] = Math.min(times[colour], artificialMaxBotTime);
			});
			
			var increment = game.getTimingStyle().increment.getMilliseconds();
			
			this._engine.stdin.write("position startpos" + (moves ? " moves " + moves : "") + "\n");
			this._engine.stdin.write("go wtime " + times[Colour.white]	+ " btime " + times[Colour.black] + " winc " + increment + " binc " + increment);
		}
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
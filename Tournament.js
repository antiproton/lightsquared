define(function(require) {
	require("Array.prototype/remove");
	var id = require("js/id");
	var Colour = require("chess/Colour");
	
	function Tournament(organiser, options) {
		this.id = id();
		
		this.PlayerJoined = new Event();
		this.PlayerLeft = new Event();
		this.Started = new Event();
		this.Canceled = new Event();
		this.Finished = new Event();
		this.GameStarted = new Event();
		this.PlayerEliminated = new Event();
		
		this.games = [];
		this.gamesInProgress = [];
		
		this.isInProgress = false;
		this.isCanceled = false;
		this.round = 1;
		this.organiser = organiser;
		this.options = options || {};
		
		this.players = [];
		this.activePlayers = [];
		this.waitingPlayers = [];
		
		this._tournamentPlayers = {};
		
		this._checkOptions();
	}
	
	Tournament.prototype.join = function(player) {
		if(!this.isInProgress && !this.isCanceled && this.players.length < this.playersRequired) {
			this._addPlayer(player);
			
			if(this.players.length === this.playersRequired) {
				this._start();
			}
			
			return true;
		}
		
		else {
			return false;
		}
	}
	
	Tournament.prototype.leave = function(player) {
		if(this.isInProgress) {
			var currentGame = this._getTournamentPlayer(player).currentGame;
			
			if(currentGame) {
				currentGame.resign(player);
			}
		}
		
		this._removePlayer(player);
		this.PlayerLeft.fire(player);
	}
	
	Tournament.prototype.cancel = function(user) {
		if(user === this.organiser && !this.isInProgress) {
			this.isCanceled = true;
			this.Canceled.fire();
		}
	}
	
	Tournament.prototype._start = function() {
		this.activePlayers = this.players.slice();
		this.waitingPlayers = this.players.slice();
		this._startGames(this._getPairings());
		this.isInProgress = true;
		this.Started.fire();
	}
	
	Tournament.prototype._startGames = function(pairings) {
		pairings.forEach(function(pairing) {
			var game = new Game(pairing.white, pairing.black, {
				initialTime: this.options.initialTime,
				timeIncrement: this.options.timeIncrement
			});
			
			for(var colour in pairing) {
				var player = pairing[colour];
				var tournamentPlayer = this._getTournamentPlayer(player);
				
				tournamentPlayer.currentGame = game;
				
				this.waitingPlayers.remove(player);
			}
			
			this.games.push(game);
			this.gamesInProgress.push(game);
			
			game.GameOver.addHandler(function(result) {
				this._gameOver(game, result);
			}, this);
			
			this.GameStarted.fire(game);
		}, this);
	}
	
	Tournament.prototype._gameOver = function(game, result) {
		Colour.forEach(function(colour) {
			var tournamentPlayer = this._getTournamentPlayer(game.players[colour]);
			
			tournamentPlayer.currentGame = null;
			
			this.waitingPlayers.push(game.players[colour]);
		}, this);
		
		this.gamesInProgress.remove(game);
		this._processResult(game, result);
		
		var pairings = this._getPairings();
		
		if(pairings.length > 0) {
			this._startGames(pairings);
		}
		
		if(this._isOver()) {
			this.Finished.fire();
		}
	}
	
	/*
	methods to override for different tournament styles.
	
	every time a game finishes, _getPairings should be called, and if
	there are any pairings then new games need to start.
	
	this accommodates warzone and round-by-round styles.
	
	in tournaments where new players can join after the start, getPairings
	should be called when new people join as well.
	*/
	
	/*
	process a finished game
	
	in knockouts, this method must knock out the loser if there is one.
	
	it must also update the tournament players' scores.
	*/
	
	Tournament.prototype._processResult = function(game, result) {
		Colour.forEach(function(colour) {
			this._getTournamentPlayer(game.players[colour]).score += result.scores[colour];
		}, this);
		
		if(!result.isDraw) {
			this._eliminatePlayer(game.players[Colour.byFenString[result.winner].opposite]);
		}
	}
	
	/*
	check whether the tournament is finished
	*/
	
	Tournament.prototype._isOver = function() {
		return (this.waitingPlayers.length === 0 && this.gamesInProgress.length === 0);
	}
	
	/*
	generate the pairings for the next round
	
	since this is currently knockout only, new pairings will only be generated
	when there are no games in progress.
	*/
	
	Tournament.prototype._getPairings = function() {
		var pairings = [];
		
		if(this.gamesInProgress.length === 0) {
			var players = this.waitingPlayers.slice().sort(function(a, b) {
				return a.getRating() - b.getRating();
			});
			
			while(players.length > 0) {
				var a = this._getTournamentPlayer(players.shift());
				var b = this._getTournamentPlayer(players.shift());
				var white = (a.gamesAsWhite > b.gamesAsWhite ? b : a);
				var black = (a === white ? b : a);
				
				pairings.push({
					white: white.player,
					black: black.player
				});
			}
		}
		
		return pairings;
	}
	
	/*
	check that the options are valid.  throw an exception if not.
	*/
	
	Tournament.prototype._checkOptions = function() {
		var n = this.options.playersRequired;
		
		switch(true) {
			case !n:
				throw "Player count must be specified";
			case n < 4:
				throw "Player count must be >= 4";
			case (n & (n - 1)) !== 0:
				throw "Player count must be a power of 2 for knockout tournaments";
		}
	}
	
	/*
	end of overridable methods
	*/
	
	Tournament.prototype._eliminatePlayer = function(player) {
		this.activePlayers.remove(player);
		this.waitingPlayers.remove(player);
		this.PlayerEliminated.fire(player);
	}
	
	Tournament.prototype._removePlayer = function(player) {
		delete this._tournamentPlayers[player.getId()];
		
		this.players.remove(player);
		this.activePlayers.remove(player);
		this.waitingPlayers.remove(player);
	}
	
	Tournament.prototype._addPlayer = function(player) {
		this._tournamentPlayers[player.getId()] = {
			player: player,
			gamesAsWhite: 0,
			score: 0,
			currentGame: null
		};
		
		this.players.push(player);
		this.activePlayers.push(player);
		this.waitingPlayers.push(player);
	}
	
	Tournament.prototype._getTournamentPlayer = function(player) {
		return this._tournamentPlayers[player.getId()];
	}
	
	return Tournament;
});
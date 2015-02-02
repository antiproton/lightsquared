define(function(require) {
	var Colour = require("chess/Colour");
	
	function Tournament(owner, playersRequired) {
		this.PlayerJoined = new Event();
		this.PlayerLeft = new Event();
		this.Started = new Event();
		this.Canceled = new Event();
		this.Finished = new Event();
		this.GameStarted = new Event();
		
		this.games = [];
		this.gamesInProgress = [];
		this.round = 1;
		this.owner = owner;
		this.players = [];
		this.currentPlayers = [];
		this.playingPlayers = [];
		this.waitingPlayers = [];
		this.isInProgress = false;
		this.playersRequired = playersRequired;
		
		if(playersRequired < 4 || playersRequired % 2 === 1) {
			throw "Players must be an even number greater than 2";
		}
	}
	
	Tournament.prototype.join = function(player) {
		if(!this.isInProgress && this.players.length < this.playersRequired) {
			this.players.push({
				player: player,
				gamesAsWhite: 0,
				rating: player.getRating(),
				score: 0
			});
			
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
		this._removePlayer(player, this.players);
		this.PlayerLeft.fire(player);
	}
	
	Tournament.prototype._start = function() {
		this.currentPlayers = this.players.slice();
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
			
			[pairing.white, pairing.black].forEach(function(player) {
				this.waitingPlayers.remove(player);
				this.playingPlayers.push(player);
			}, this);
			
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
			this._removePlayer(game.players[colour], this.playingPlayers);
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
	*/
	
	/*
	process a finished game
	
	this method must add the players to waitingPlayers if them/they are
	still in the game
	*/
	
	Tournament.prototype._processResult = function(game, result) {
		Colour.forEach(function(colour) {
			this._removePlayer(game.players[colour], this.waitingPlayers);
		}, this);
	}
	
	/*
	check whether the tournament is finished
	*/
	
	Tournament.prototype._isOver = function() {
		return (this.waitingPlayers.length === 0 && this.gamesInProgress.length === 0);
	}
	
	/*
	generate the pairings for the next round
	
	since this is currently round-robin only, new pairings will not be generated
	unless all games are finished (or the tournament hasn't started yet).
	*/
	
	Tournament.prototype._getPairings = function() {
		var pairings = [];
		
		if(this.gamesInProgress.length === 0) {
			var players = this.waitingPlayers.slice().sort(function(a, b) {
				return a.rating - b.rating;
			});
			
			while(players.length > 0) {
				var a = players.shift();
				var b = players.shift();
				var white = (a.gamesAsWhite > b.gamesAsWhite ? b : a);
				var black = (a === white ? b : a);
				
				pairings.push({
					white: white,
					black: black
				});
			}
		}
		
		return pairings;
	}
	
	Tournament.prototype._removePlayer = function(player, list) {
		list.filterInPlace(function(tournamentPlayer) {
			return (tournamentPlayer !== player);
		});
	}
	
	return Tournament;
});
define(function(require) {
	var Event = require("lib/Event");
	
	function RandomGames(app, count) {
		this._app = app;
		this._count = count;
		this._games = [];
		
		this.Move = new Event();
		this.GameOver = new Event();
		this.NewGame = new Event();
		
		this._app.NewGame.addHandler(this, function(game) {
			if(this._games.length < this._count) {
				this._addGame(game);
				this.NewGame.fire(game);
			}
		});
		
		this._app.getCurrentGames().slice(0, this._count).forEach(this._addGame.bind(this));
	}
	
	RandomGames.prototype.getGames = function() {
		return this._games;
	}
	
	RandomGames.prototype._addGame = function(game) {
		this._games.push(game);
		
		game.GameOver.addHandler(this, function() {
			this._removeGame(game);
		});
		
		game.Aborted.addHandler(this, function() {
			this._removeGame(game);
		});
		
		game.Move.addHandler(this, function(move) {
			this.Move.fire({
				game: game,
				move: move
			});
		});
	}
	
	RandomGames.prototype._removeGame = function(game) {
		this._games.remove(game);
		this.GameOver.fire(game);
	}
	
	return RandomGames;
});
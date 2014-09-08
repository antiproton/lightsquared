define(function(require) {
	var Event = require("js/Event");
	
	function RandomGames(app, count) {
		this._app = app;
		this._count = count;
		this._games = [];
		
		this.Move = new Event();
		this.GameOver = new Event();
		this.NewGame = new Event();
		
		this._app.NewGame.addHandler(function(game) {
			if(this._games.length < this._count) {
				this._addGame(game);
				this.NewGame.fire(game);
			}
		}, this);
		
		this._app.getCurrentGames().slice(0, this._count).forEach(this._addGame.bind(this));
	}
	
	RandomGames.prototype.getGames = function() {
		return this._games;
	}
	
	RandomGames.prototype._addGame = function(game) {
		this._games.push(game);
		
		game.GameOver.addHandler(function() {
			this._removeGame(game);
		}, this);
		
		game.Aborted.addHandler(function() {
			this._removeGame(game);
		}, this);
		
		game.Move.addHandler(function(move) {
			this.Move.fire({
				game: game,
				move: move
			});
		}, this);
	}
	
	RandomGames.prototype._removeGame = function(game) {
		this._games.remove(game);
		this.GameOver.fire(game);
	}
	
	return RandomGames;
});
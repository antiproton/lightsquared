define(function(require) {
	var Piece=require("chess/Piece");
	var Game=require("./Game");
	
	function Table(owner, gameOptions) {
		this._owner=owner;
		
		this._gameOptions=gameOptions;
		
		this._players=[];
		this._players[Piece.WHITE]=null;
		this._players[Piece.BLACK]=null;
		
		this._playerIsReady=[];
		this._playerIsReady[Piece.WHITE]=false;
		this._playerIsReady[Piece.BLACK]=false;
		
		this._games=[];
		this._currentGame=null;
	}
	
	Table.prototype.sit=function(user, colour) {
		this._players[colour]=user;
	}
	
	Table.prototype.ready=function(colour) {
		this._playerIsReady[colour]=true;
		
		if(this._allPlayersAreReady) {
			this._startGame();
		}
	}
	
	Table.prototype._startGame=function() {
		var game=new Game(this, this._players[Piece.WHITE], this._players[Piece.BLACK], this._gameOptions);
		
		this._games.push(game);
		this._currentGame=game;
	}
	
	Table.prototype._areAllPlayersReady=function() {
		return (this._playerIsReady[Piece.WHITE] && this._playerIsReady[Piece.BLACK]);
	}
	
	Table.prototype.toJSON=function() {
		return {
			owner: this._owner,
			white: this._players[Piece.WHITE],
			black: this._players[Piece.BLACK],
			games: this._games,
			currentGame: this._currentGame
		};
	}
	
	return Table;
});
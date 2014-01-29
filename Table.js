define(function(require) {
	var Piece=require("chess/Piece");
	var Game=require("./Game");
	
	function Table(owner) {
		this._owner=owner;
		
		this._players=[];
		this._players[Piece.WHITE]=null;
		this._players[Piece.BLACK]=null;
		
		this._playerIsReady=[];
		this._playerIsReady[Piece.WHITE]=false;
		this._playerIsReady[Piece.BLACK]=false;
		
		this._game=null;
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
		this._game=new Game();
	}
	
	Table.prototype._allPlayersAreReady=function() {
		return (this._playerIsReady[Piece.WHITE] && this._playerIsReady[Piece.BLACK]);
	}
	
	return Table;
});
define(function(require) {
	var ChessGame=require("chess/Game");
	var Piece=require("chess/Piece");
	
	function Game(white, black) {
		this._game=new ChessGame();
		
		this._players=[];
		this._players[Piece.WHITE]=white;
		this._players[Piece.BLACK]=black;
	}
	
	
	
	return Game;
});
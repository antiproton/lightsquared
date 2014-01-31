define(function(require) {
	var Position=require("chess/Position");
	
	function Move(details) {
		this._details=details;
	}
	
	Move.prototype.getLabel=function() {
		return this._details.label;
	}
	
	Move.prototype.getFullLabel=function() {
		return this._details.fullLabel;
	}
	
	Move.prototype.getColour=function() {
		return this._details.colour;
	}
	
	Move.prototype.getFullmove=function() {
		return this._details.fullmove;
	}
	
	Move.prototype.getCapturedPiece=function() {
		return this._details.capturedPiece;
	}
	
	Move.prototype.isCheck=function() {
		return this._details.isCheck;
	}
	
	Move.prototype.isMate=function() {
		return this._details.isMate;
	}
	
	Move.prototype.isCastling=function() {
		return this._details.isCastling;
	}
	
	Move.prototype.getPositionAfter=function() {
		return new Position(this._details.resultingFen);
	}
	
	Move.prototype.getTime=function() {
		return this._details.time;
	}
	
	Move.prototype.isLegal=function() {
		return true;
	}
	
	Move.prototype.toJSON=function() {
		return this._details;
	}
	
	return {
		fromJSON: function(json) {
			return new Move(json);
		},
		
		fromMove: function(move) {
			if(move.isLegal()) {
				return new Move({
					label: move.getLabel(),
					fullLabel: move.getFullLabel(),
					colour: Colour.getFen(move.getColour()),
					fullmove: move.getFullmove(),
					isCheck: move.isCheck(),
					isMate: move.isMate(),
					isCastling: move.isCastling(),
					resultingFen: move.getPositionAfter().getFen(),
					capturedPiece: move.getCapturedPiece(),
					time: move.getTime()
				});
			}
			
			else {
				return null;
			}
		}
	};
});
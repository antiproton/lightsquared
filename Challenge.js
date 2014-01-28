define(function(require) {
	var id=require("lib/id");
	var Piece=require("chess/Piece");
	var Chess=require("chess/Chess");
	
	function Challenge(owner, options) {
		this._id=id();
		this._owner=owner;
		this._players=[];
		this._players[Piece.WHITE]=null;
		this._players[Piece.BLACK]=null;
		this._isAccepted=false;
		
		this._options={
			ownerPlaysAs: null,
			rated: true
		};
		
		for(var p in options) {
			this._options[p]=options[p];
		}
	}
	
	Challenge.prototype.getId=function() {
		return this._id;
	}
	
	Challenge.prototype.accept=function(user) {
		if(this._options.playAs===null) {
			var ownerRatio=this._owner.getGamesAsWhiteRatio();
			var guestRatio=user.getGamesAsWhiteRatio();
			
			if(ownerRatio>guestRatio) {
				this._players[Piece.WHITE]=user;
				this._players[Piece.BLACK]=this._owner;
			}
			
			else {
				this._players[Piece.WHITE]=this._owner;
				this._players[Piece.BLACK]=user;
			}
		}
		
		else {
			this._players[this._options.ownerPlaysAs]=this._owner;
			this._players[Chess.getOppColour(this._options.ownerPlaysAs)]=user;
		}
		
		this._isAccepted=true;
	}
	
	Challenge.prototype.toJSON=function() {
		return {
			id: this._id,
			owner: this._owner
		};
	}
	
	return Challenge;
});
define(function(require) {
	require("Array.prototype/remove");
	
	function Tournament(owner, playersRequired) {
		this._owner = owner;
		this._players = [];
		this._isInProgress = false;
		this._playersRequired = playersRequired;
		
		if(playersRequired < 4 || playersRequired % 2 === 1) {
			throw "Players must be an even number greater than 2";
		}
	}
	
	Tournament.prototype.getOwner = function() {
		return this._owner;
	}
	
	Tournament.prototype.getPlayers = function() {
		return this._players;
	}
	
	Tournament.prototype.join = function(player) {
		if(this._players.length < this._playersRequired) {
			this._players.push(player);
			
			if(this._players.length === this._playersRequired) {
				this._isInProgress = true;
			}
			
			return true;
		}
		
		else {
			return false;
		}
	}
	
	Tournament.prototype.leave = function(player) {
		this._players.remove(player);
	}
	
	Tournament.prototype.isInProgress = function() {
		return this._isInProgress;
	}
	
	return Tournament;
});
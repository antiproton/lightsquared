define(function(require) {
	function Challenge(owner) {
		this._owner=owner;
	}
	
	Challenge.prototype.toJSON=function() {
		return {
			owner: this._owner.username
		};
	}
	
	return Challenge;
});
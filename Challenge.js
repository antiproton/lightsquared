define(function(require) {
	var id=require("lib/id");
	
	function Challenge(owner) {
		this.id=id();
		this._owner=owner;
	}
	
	Challenge.prototype.toJSON=function() {
		return {
			id: this.id,
			owner: this._owner
		};
	}
	
	return Challenge;
});
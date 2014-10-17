define(function(require) {
	function Feed(bindTo, handlers, sendInitialData) {
		this._bindTo = bindTo;
		this._handlers = [];
		
		handlers.forEach(function(pair) {
			this._handlers.push(pair.event.addHandler(pair.handler, this._bindTo));
		}, this);
		
		this._handlers.forEach(function(handler) {
			handler.remove();
		});
		
		this._sendInitialData = sendInitialData || null;
		this._isActive = false;
	}
	
	Feed.prototype.activate = function() {
		if(!this._isActive) {
			this._handlers.forEach(function(handler) {
				handler.add();
			});
			
			this._isActive = true;
		}
		
		if(this._sendInitialData) {
			this._sendInitialData.call(this._bindTo);
		}
	}
	
	Feed.prototype.deactivate = function() {
		if(this._isActive) {
			this._handlers.forEach(function(handler) {
				handler.remove();
			});
			
			this._isActive = false;
		}
	}
	
	return Feed;
});
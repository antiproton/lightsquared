define(function(require) {
	function Feed(bindTo, handlers, setup, teardown) {
		this._bindTo = bindTo;
		this._handlers = [];
		
		handlers.forEach(function(pair) {
			this._handlers.push(pair.event.addHandler(pair.handler, this._bindTo));
		}, this);
		
		this._handlers.forEach(function(handler) {
			handler.remove();
		});
		
		this._setup = setup || null;
		this._teardown = teardown || null;
		this._isActive = false;
	}
	
	Feed.prototype.activate = function() {
		if(!this._isActive) {
			this._handlers.forEach(function(handler) {
				handler.add();
			});
			
			if(this._setup) {
				this._setup();
			}
			
			this._isActive = true;
		}
	}
	
	Feed.prototype.deactivate = function() {
		if(this._isActive) {
			this._handlers.forEach(function(handler) {
				handler.remove();
			});
			
			if(this._teardown) {
				this._teardown();
			}
		}
	}
	
	return Feed;
});
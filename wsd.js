var requirejs=require("requirejs");

requirejs.config({
	nodeRequire: require,
	paths: {
		"lib": "/var/www/lib/js"
	},
	map: {
		"*": {
			"css": "lib/require-css/css",
			"file": "lib/require-text/text",
			"chess": "../chess"
		}
	}
});

requirejs(["./server"], function(server) {
	server.run();
});
#!/usr/bin/js

var requirejs = require("requirejs");

requirejs.config({
	nodeRequire: require,
	paths: {
		"lib": "/var/www/lib/js"
	},
	map: {
		"*": {
			"chess": "lib/chess",
			"jsonchess": "lib/jsonchess"
		}
	}
});

requirejs(["lib/websocket/server/Server", "./Application"], function(Server, Application) {
	var server = new Server(8080);
	var app = new Application(server);
});
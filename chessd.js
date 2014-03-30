#!/usr/bin/js

var requirejs = require("requirejs");
var fs = require("fs");

fs.writeFileSync("/var/run/chessd.pid", process.pid.toString());

requirejs.config({
	nodeRequire: require,
	paths: {
		"lib": "/var/www/lib/js"
	},
	map: {
		"*": {
			"common": "..",
			"chess": "lib/chess"
		}
	}
});

requirejs(["lib/websocket-server/Server", "./Application"], function(Server, Application) {
	var server = new Server(8080);
	var app = new Application(server);
});
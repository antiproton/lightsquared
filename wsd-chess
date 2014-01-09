#!/usr/bin/js

var requirejs=require("requirejs");
var fs=require("fs");

fs.writeFileSync("/var/run/wsd-chess.pid", process.pid.toString());

requirejs.config({
	nodeRequire: require,
	paths: {
		"lib": "/var/www/lib/js"
	},
	map: {
		"*": {
			"chess": "../chess"
		}
	}
});

requirejs(["./main"], function(main) {
	main();
});
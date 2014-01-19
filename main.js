#!/usr/bin/js

var requirejs=require("requirejs");
var fs=require("fs");

fs.writeFileSync("/var/run/chessd.pid", process.pid.toString());

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

requirejs(["./Application", "./Server"], function(Application, Server) {
	var server=new Server();
	var app=new Application(server);
	
	server.run();
});
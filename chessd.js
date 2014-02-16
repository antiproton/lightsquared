#!/usr/bin/js

var requirejs=require("requirejs");
var fs=require("fs");

//FIXME this doesn't work; writes the wrong PID
//fs.writeFileSync("/var/run/chessd.pid", process.pid.toString());

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

requirejs(["./Application", "lib/websocket-server/Server"], function(Application, Server) {
	var server=new Server();
	var app=new Application(server);
	
	server.run();
});
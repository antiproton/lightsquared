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

requirejs(["lib/websocket-server/Server", "./Application"], function(Server, Application) {
	var server=new Server(8080);
	var app=new Application(server);
});
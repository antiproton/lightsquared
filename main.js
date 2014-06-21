#!/usr/bin/js

var requirejs = require("requirejs");
var mongodb = require("mongodb");

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
	mongodb.MongoClient.connect("mongodb://localhost:27017/lightsquare", function(error, db) {
		if(db) {
			var server = new Server(8080);
			var app = new Application(server, db);
		}
		
		else {
			process.exit(1);
		}
	});
});
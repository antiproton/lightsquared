#!/usr/bin/js

var requirejs = require("requirejs");
var mongodb = require("mongodb");
var yargs = require("yargs");

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

yargs.default({
	bots: 0
});

requirejs(["lib/websocket/server/Server", "./Application", "./Bot"], function(Server, Application, Bot) {
	mongodb.MongoClient.connect("mongodb://localhost:27017/lightsquare", function(error, db) {
		if(db) {
			var server = new Server(8080);
			var app = new Application(server, db);
			
			for(var i = 0; i < yargs.argv.bots; i++) {
				new Bot(app);
			}
		}
		
		else {
			console.log("Cannot connect to mongodb");
			console.log(error);
			process.exit(1);
		}
	});
});
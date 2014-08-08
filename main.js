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

var argv = yargs.default({
	bots: 0,
	port: 8080
}).argv;

requirejs(["lib/websocket/server/Server", "./Application", "./Bot"], function(Server, Application, Bot) {
	mongodb.MongoClient.connect("mongodb://localhost:27017/lightsquare", function(error, db) {
		if(db) {
			var server = new Server(argv.port);
			var app = new Application(server, db);
			
			for(var i = 0; i < argv.bots; i++) {
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
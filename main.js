#!/usr/bin/js

var requirejs = require("requirejs");
var mongodb = require("mongodb");
var yargs = require("yargs");

/*
amdefine/intercept - allows requirejs-style modules to be required
through Node's require.

NOTE this has to be after the Node require that requires requirejs,
because once loaded it tacks some code onto the beginning of all
node-required modules, checking whether the define function exists
and defining it if not, and this messes up the "r.js" module for
some reason.
*/

require("amdefine/intercept");

var Server = require("websocket-server/Server");
var Application = require("./Application");
var Bot = require("./Bot");

requirejs.config({
	nodeRequire: require
});

var argv = yargs.default({
	bots: 0,
	port: 8080
}).argv;

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
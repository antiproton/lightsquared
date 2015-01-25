#!/usr/bin/js

var requirejs = require("requirejs");
var fs = require("fs");

requirejs.config({
	nodeRequire: require
});

require("amdefine/intercept");

var testsDir = "./tests";

var tests = fs.readdirSync(testsDir).map(function(filename) {
     return testsDir + "/" + filename.substr(0, filename.indexOf("."));
});

requirejs(tests);
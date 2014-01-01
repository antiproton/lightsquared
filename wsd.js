var requirejs=require("requirejs");

requirejs.config({
	nodeRequire: require
});

requirejs(["./ChessServer"], function(ChessServer) {
	ChessServer.run();
});
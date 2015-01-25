define(function(require, exports, module) {
	var chai = require("chai");
	var runTests = require("test-runner/runTests");
	var Tournament = require("../Tournament");
	
	var tests = {
		"can create new tournament": function() {
			var tournament = new Tournament();
		}
	};
	
	runTests(module.id, tests);
});
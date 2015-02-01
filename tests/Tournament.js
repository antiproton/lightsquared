define(function(require, exports, module) {
	var chai = require("chai");
	var runTests = require("test-runner/runTests");
	var Tournament = require("../Tournament");
	
	function Player(name) {
		this.name = name;
	}
	
	var tests = {
		"creation fails with fewer than 4 players":
		
		function() {
			try {
				var tournament = new Tournament(new Player("2"), 2);
				
				chai.assert.isTrue(false);
			}
			
			catch(e) {
				if(e instanceof chai.AssertionError) {
					throw e;
				}
				
				chai.assert.isTrue(true);
			}
		},
		
		"creation fails with odd number of players":
		
		function() {
			try {
				var tournament = new Tournament(new Player("2"), 5);
				
				chai.assert.isTrue(false);
			}
			
			catch(e) {
				if(e instanceof chai.AssertionError) {
					throw e;
				}
				
				chai.assert.isTrue(true);
			}
		},
		
		"owner of tournament is returned from getOwner":

		function() {
			var owner = {
				username: "gus"
			};
			
			var tournament = new Tournament(owner);
			
			chai.assert.equal(tournament.getOwner(), owner);
		},
		
		"players is empty array when no players have joined":

		function() {
			var tournament = new Tournament({});
			
			chai.assert.deepEqual(tournament.getPlayers(), []);
		},
		
		"a player can join a tournament":
		
		function(tournament, player) {
			tournament.join(player);
		},
		
		"after the first player joins, players is array of that player":

		function(tournament, player) {
			tournament.join(player);
			
			chai.assert.deepEqual(tournament.getPlayers(), [player]);
		},
		
		"when 2 players join, getPlayers is an array of those players":

		function(tournament) {
			var p1 = new Player("1");
			var p2 = new Player("2");
			
			tournament.join(p1);
			tournament.join(p2);
			
			chai.assert.deepEqual(tournament.getPlayers(), [p1, p2]);
		},
		
		"when a player joins and then leaves an empty tournament, getPlayers is []":

		function(tournament, player) {
			tournament.join(player);
			tournament.leave(player);
			
			chai.assert.deepEqual(tournament.getPlayers(), []);
		},
		
		"when two players join and then the second leaves, getPlayers is an array of the first":

		function(tournament) {
			var p1 = new Player("1");
			var p2 = new Player("2");
			
			tournament.join(p1);
			tournament.join(p2);
			tournament.leave(p2);
			
			chai.assert.deepEqual(tournament.getPlayers(), [p1]);
		},
		
		"on initial creation, a tournament is not in progress":

		function(tournament) {
			chai.assert.equal(tournament.isInProgress(), false);
		},
		
		"when fewer than the required number of players have joined, a tournament is not in progress":

		function() {
			var tournament = new Tournament(new Player("1"), 4);
			
			tournament.join(new Player("2"));
			tournament.join(new Player("3"));
			tournament.join(new Player("4"));
			
			chai.assert.equal(tournament.isInProgress(), false);
		},
		
		"when the required number of players have joined, a tournament is in progress":

		function() {
			var tournament = new Tournament(new Player("1"), 4);
			
			tournament.join(new Player("2"));
			tournament.join(new Player("3"));
			tournament.join(new Player("4"));
			tournament.join(new Player("5"));
			
			chai.assert.equal(tournament.isInProgress(), true);
		},
		
		"when a tournament is in progress, no one else can join":

		function() {
			var tournament = new Tournament(new Player("1"), 4);
			var player2 = new Player("2");
			var player3 = new Player("3");
			var player4 = new Player("4");
			var player5 = new Player("5");
			
			tournament.join(player2);
			tournament.join(player3);
			tournament.join(player4);
			tournament.join(player5);
			
			chai.assert.equal(tournament.join(new Player("6")), false);
			chai.assert.deepEqual(tournament.getPlayers(), [player2, player3, player4, player5]);
		}
	};
	
	runTests(module.id, tests, function() {
		var player = new Player("player1");
		
		return [new Tournament(player, 8), player];
	});
});
Lightsquared
============

Lightsquared is a chess server.  Clients connect to it using
WebSockets to play against each other or against bots using the
Stockfish engine.

Installation
------------

- Download the code
- $npm install

Running the server
------------------

Invoke main.js directly, or use [forever][3] to run it in the background.

Use the --bots N option to create computer players, e.g. $js main.js --bots 5.

**Example forever command:**

```
forever start /home/gus/lightsquared/main.js --bots 5
```

[3]:https://github.com/nodejitsu/forever
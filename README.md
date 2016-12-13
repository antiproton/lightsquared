Lightsquared
============

Lightsquared is a chess server.  Clients connect to it using
WebSockets to play against each other or against bots using the
Stockfish engine.

Installation
------------

See [a screencast](https://www.youtube.com/watch?v=PR2FBr_5wiI) showing the
installation procedure or follow the steps below:

- Download the code
- `cd` to the directory
- Run `$npm install`
- To make bots work, install the [Stockfish engine](http://stockfishchess.org/)
    (`#apt-get install stockfish`, or download it and place `stockfish`
    somewhere on your path)
- copy `config.dist.js` and rename to `config.js`

**Note** - the `websocket` module requires the `node` command, which can be obtained by
installing the `nodejs-legacy` package, or possibly by just symlinking /usr/bin/node
to /usr/bin/nodejs.

Running the server
------------------

Invoke main.js directly, or use [forever][3] to run it in the background (`#npm install
-g forever`).

Use the `bots` property in `config.js` option to create computer players.

**Example forever command:**

```
forever start /home/gus/projects/lightsquared/main.js
```

[3]:https://github.com/nodejitsu/forever
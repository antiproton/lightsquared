Lightsquared
============

Lightsquared is a [jsonchess][2] server.  Clients connect to it using
WebSockets to play chess against each other.

Installation
------------

- Download the code
- Download the following repos and place them according to the RequireJS paths configuration in main.js:
    - [websocket][4]
    - [js][6]
    - [tokeniser][7]
    - [Array.prototype][8]
    - [chess][10]
    - [jsonchess][12]
- $npm install

Running the server
------------------

Invoke main.js directly, or use [forever][3] to run it in the background.

Use the --bots N option to create computer players, e.g. $js main.js --bots 5.

**Example forever command:**

```
forever start /home/gus/lightsquared/main.js --bots 5
```

[1]:http://github.com/gushogg-blake/libjs
[2]:http://jsonchess.org
[3]:https://github.com/nodejitsu/forever
[4]:http://github.com/gushogg-blake/websocket
[6]:http://github.com/gushogg-blake/js
[7]:http://github.com/gushogg-blake/tokeniser
[8]:http://github.com/gushogg-blake/Array.prototype
[10]:http://github.com/gushogg-blake/chess
[12]:http://github.com/gushogg-blake/jsonchess
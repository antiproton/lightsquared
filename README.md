Lightsquared
============

Lightsquared is a [jsonchess][2] server.  Clients connect to it using
WebSockets to play chess against each other.

Installation
------------

- Download the code
- Download [libjs][1] and place it where it will be found under the 'lib' path as mapped in the requirejs config in main.js
- Download [jsonchess][2] and put it in the libjs folder
- $npm install

Running the server
------------------

Invoke main.js directly, or use [forever][3] to run it in the background.

Use the --bots N option to create computer players, e.g. $js main.js --bots 5.

**Example forever command:**

```
forever start /home/gus/lightsquared/main.js --bots 5
```

[1]:http://github.com/lightsquaredev/libjs
[2]:http://github.com/lightsquaredev/jsonchess
[3]:https://github.com/nodejitsu/forever
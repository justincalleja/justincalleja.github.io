---
date: "2014-12-06"
title: "Taking the Express route out"
tags: [ "node", "express" ]
categories: [ "programming" ]
tocEnabled: true

---

# Purpose

Example of how to separate route code in Express.js using `npm link`.

# Setting up

We can use the express generator to get up and running quickly with Express. Install it with `npm install express-generator -g` if you don't already have it:

``` bash
tmp$ express todo-server
tmp$ cd todo-server
todo-server$ npm install
```

It might be worth mentioning that at the time of writing, this installs express at version approx 4.9.0 or *~4.9.0*.

At this point we could `npm start` to start our server. As defined in package.json, we're basically running `node ./bin/www`.

We now want to start working on a separate module which will contain the logic behind the */items* route in our application:

``` bash
todo-server$ mkdir ../todo-items
todo-server$ cd ../todo-items
todo-items$ npm init
todo-items$ npm install --save express
```

# Writing some code

``` bash
todo-items$ vim index.js
```

``` javascript
var express = require('express');
var router = express.Router();

var items = require('./items.json');

router.get('/', function(req, res) {
  res.send(items);
});

module.exports = router;
```

``` bash
todo-items$ vim items.json
```

``` json
{
    "task A": true,
    "task B": false
}
```

We're just defining a GET on '/'.  This means that, whichever route our *todo-items* module gets loaded on in *todo-server*, making a GET request on it will give us back our items.json data.

That's great but *todo-server* doesn't have *todo-items* installed so how's it going to use it? We could publish *todo-items* on npm or host it in a Git repo on Github for example.

As you can see, we're just experimenting with *todo-items* for now. Maybe later we'll use a proper database. Maybe we're not sure which database to go with. Point is, we don't want to publish or host *todo-items* as it's still early days, and besides, it would be better to avoid having to stay re-installing the module for every single change we make.

Enter `npm link`:

``` bash
todo-items$ npm link
/Users/justin/.nvm/v0.10.33/lib/node_modules/todo-items -> /Users/justin/tmp/todo-items

todo-items$ cd ../todo-server
todo-server$ npm link todo-items
/Users/justin/tmp/todo-server/node_modules/todo-items -> /Users/justin/.nvm/v0.10.33/lib/node_modules/todo-items -> /Users/justin/tmp/todo-items
```

Executing it from *todo-items* we get a link to this directory from our global node\_modules. `npm link todo-items` in *todo-server* gets us a link in *todo-server*'s node\_modules to the link in our global node\_modules, effectively linking back to our *todo-items* directory containing our implementation for that module. 

End result - if you list the contents of *todo-server*'s node\_modules you'll see we have our *todo-items* in there, albeit a link and not an actual directory structure as our other dependencies are installed as. Now, since the *todo-items* installation in our *todo-server* is just a link, any updates we make in *todo-items* will automatically take effect in our *todo-server* project.

# Seeing it work

Simply require and use:

``` bash
todo-server$ vim app.js
```

``` javascript
var items = require('todo-items');
app.use('/items', items);
```

Now we can `npm start`, hit http://localhost:3000/items in a browser, and get our items.json back.

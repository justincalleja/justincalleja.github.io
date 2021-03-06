---
date: "2014-12-26"
title: "Setting up Karma with Mocha, Chai, and RequireJS"
tags: [ "node", "karma", "mocha", "requirejs", "chai" ]
categories: [ "programming" ]
tocEnabled: true

---

# Following along

If you want to follow along with the end result at hand, the repo is up on [Github](https://github.com/justin-calleja/setting-up-karma-with-mocha-chai-requirejs "setting-up-karma-with-mocha-chai-requirejs"). You will need to install dependencies with `npm install && bower install`

|             |  Versions  |               |
|:------------|:----------:|--------------:|
| Karma       |            |    0.12.28    |
| Node        |            |    0.10.33    |
| NPM         |            |     1.4.28    |
| Bower       |            |     1.3.12    |

# Purpose

Going from zero to a project which supports running [Mocha](http://mochajs.org/ "Mocha")/[Chai](http://chaijs.com/ "Chai") tests on a browser through [Karma](http://karma-runner.github.io/0.12/index.html "Karma"), with modularity concerns handled by [RequireJS](http://requirejs.org/ "RequireJS").

# Other resources

* http://karma-runner.github.io/0.12/plus/requirejs.html and accompanying repo https://github.com/kjbekkelund/karma-requirejs
  * Great resources to start off with. It's using Jasmine though. I'd like to set this up with Mocha/Chai so it's not exactly what I'm looking for. I still borrow heavily from these two resources here.
* http://attackofzach.com/setting-up-a-project-using-karma-with-mocha-and-chai/
  * This one is interesting and it works (I don't remember if I had to change anything but if I did - nothing major). The only point where it fell short for me was that I needed to have RequireJS in the mix.
* https://github.com/x2es/boilerplate-karma-mocha-chai-requirejs.git
  * This seemed really promising at first, but I've had no luck getting it to work. After `npm install` and `karma start` I get:
  > /Users/justin/tmp/boilerplate-karma-mocha-chai-requirejs/node\_modules/karma/node\_modules/di/lib/injector.js:9
  > 
  > throw error('No provider for "' + name + '"!');

    Then I figure out it's missing some dependencies (maybe it was made to work against an older version of Karma even though it's set to 'latest' in package.json). So I `npm i --save-dev karma-requirejs karma-chai karma-chrome-launcher` to see what happens when the missing dependencies are installed, but running Karma again gives me:
  > Chrome 39.0.2171 (Mac OS X 10.10.1) ERROR
  >
  > Uncaught Error: Mismatched anonymous define() module: function () {
  >
  > return (root.sinon = factory());
  >
  > }
  >
  > http://requirejs.org/docs/errors.html#mismatch
  >
  > at /Users/justin/tmp/boilerplate-karma-mocha-chai-requirejs/node\_modules/requirejs/require.js:141
  >
  > ERROR [karma]: [TypeError: Cannot set property 'results' of undefined]

    At this point I decided it would be better to try set this up from scratch. I'd still have to do this to better understand what's going on.

# Setting up Karma

Install karma-cli globally if you don't already have it `npm i -g karma-cli`. This will allow us to use `karma` from our projects which have karma installed locally (i.e. instead of `./node_modules/karma/bin/karma`). Then set up the project:

1. `npm init`
2. `npm i --save-dev karma`
3. `karma init`

    > Which testing framework do you want to use ?
    > Press tab to list possible options. Enter to move to the next question.

    > \> **mocha**
     
    > Do you want to use Require.js ?
    > This will add Require.js plugin.
    > Press tab to list possible options. Enter to move to the next question.

    > \> **yes**
    > 
    > Do you want to capture any browsers automatically ?
    > Press tab to list possible options. Enter empty string to move to the next question.

    > \> **Chrome**

    > \>
     
    > What is the location of your source and test files ?
    > You can use glob patterns, eg. "js/\*.js" or "test/\*\*/\*Spec.js".
    > Enter empty string to move to the next question.

    > \> **src/\*\*/\*.js**
     
    > \> **test/\*\*/\*Spec.js**

    > \> **lib/\*\*/\*.js**

    > \>

    > Should any of the files included by the previous patterns be excluded ?
    You can use glob patterns, eg. "\*\*/\*.swp".
    Enter empty string to move to the next question.

    > **src/main.js**

    > \>

    > Do you wanna generate a bootstrap file for RequireJS?
    This will generate test-main.js/coffee that configures RequireJS and starts the tests.

    > \> **yes**

    > Do you want Karma to watch all the files and run the tests on change ?
    Press tab to list possible options.

    > \> **yes**

    Ignore any warning messages related to patterns not matching any files (they won't since we don't have them yet).

This will bring in the Node dependencies we need as well as set us up with a *karma.conf.js* and *test-main.js* file.

## karma.conf.js

This file contains our Karma configuration as per the `karma init` choices we made. Note the **files** key which lists the files which are loaded by the Karma server (some are included in the browser, some are not depending on the 'included' key shown in the snippet below). 'test-main.js' has the default included value of true while the files matched by the other three patterns are **not** included in the browser using script tags (they are watched for changes though and can be served from the Karma server (e.g. by requiring them via RequireJS)). You can read up more on this part of the config file [here](http://karma-runner.github.io/0.12/config/files.html). I'd rather have 'test-main.js' in the 'test' directory though, so lets move it and mirror the change in the config:

1. `mkdir test`
2. `mv test-main.js test/test-main.js`
3. `vim karma.conf.js`

    ```javascript
        files: [
          'test/test-main.js',
          {pattern: 'src/**/*.js', included: false},
          {pattern: 'test/**/*Spec.js', included: false},
          // include lib/**/*.js otherwise trying to load jquery etc.. from test's RequireJS will fail
          {pattern: 'lib/**/*.js', included: false}
        ],
    ```

Also note that we're excluding 'src/main.js', the file that will contain our RequireJS configuration for when we'll be bringing in our dependencies from our app's HTML file. For the purposes of testing, that configuration will be done in 'test/test-main.js' instead.

## test-main.js

```javascript
var allTestFiles = [];
var TEST_REGEXP = /(spec|test)\.js$/i;

var pathToModule = function(path) {
  return path.replace(/^\/base\//, '').replace(/\.js$/, '');
};

Object.keys(window.__karma__.files).forEach(function(file) {
  if (TEST_REGEXP.test(file)) {
    // Normalize paths to RequireJS module names.
    allTestFiles.push(pathToModule(file));
  }
});

require.config({
  // Karma serves files under /base, which is the basePath from your config file
  // Look at your browser's debugging console if you have trouble loading in files via RequireJS
  // (in our case, we are starting Chrome from Karma).
  baseUrl: '/base',

  // dynamically load all test files
  deps: allTestFiles,

  // The tests are loaded in asynchronously via RequireJS 
  // so we need to indicate which function to run to kick things off once they have been loaded.
  // i.e. if you don't include this callback, the tests will not run
  // In our case, Mocha will be running the tests and the karma-mocha adapter has mapped the function to
  // kick things off to window.__karma__.start
  callback: window.__karma__.start
});
```

The dependencies (i.e. the tests we want to run) are evaluated dynamically from the files we specified for inclusion in our karma.conf.js file. More specifically, we are filtering out from these files those which match the TEST\_REGEXP expression (i.e. any files which end with 'spec.js' or 'test.js' irrespective of this suffix's case). The final part of this dependency evaluation is noramlizing the file path to be a correct RequireJS module name by taking off the '/base/' prefix and '.js' suffix.

After these dependencies are loaded, we are executing the 'window.\_\_karma\_\_.start' function to run our tests as specified in the [callback](http://requirejs.org/docs/api.html#config-callback) key.

# Setting up front-end dependencies

Now that Karma's in place, we'll want to start pulling in our front-end dependencies. I'll be using Bower to do that, changing the directory in which Bower installs dependencies to 'lib':

1. Install Bower globally if you don't already have it (you'll probably be using this in many projects so it's best to have it globally installed anyway): `npm install -g bower`
2. `bower init`
3. `vim .bowerrc`

    ```json
    {
        "directory": "lib"
    }
    ```
4. `bower i --save-dev jquery lodash requirejs`
  * This will create the directory 'lib' if necessary
  * Note: the 'requirejs' we're pulling in here is not the one which will be used in our Karma tests.

You should now have some front-end packages in your lib directory and the appropriate changes in bower.json.

Also, maybe this is worth addressing. As noted above, the RequireJS we're pulling in for our front-end app is not the same RequireJS we're running in our Karma test. When we'll actually be taking Karma for a spin, you'll be able to inspect your browser's console and see that it's loading the RequireJS in our node\_modules. This is set up via the karma-requirejs plugin we're referring to in our **frameworks** key in karma.conf.js.

So basically, the RequireJS we're pulling in via Bower is the one we'll be making use of from our index.html.

# Dummy test

For the sake of having something to run, I will bring in some code from this repo: https://github.com/kjbekkelund/karma-requirejs

I'd like to work with Mocha/Chai though, so I'll be making some changes.

Lets start with [src/app.js](https://github.com/kjbekkelund/karma-requirejs/blob/master/src/app.js) (also shown below):

1. `mkdir src`
2. `vim src/app.js`

    ```javascript
    define(function() {
        var App = function(el) {
            this.el = el;
        };

        App.prototype.render = function() {
            this.el.html('require.js up and running');
        };

        return App;
    });
    ```

Next up, we'll add [test/appSpec.js](https://github.com/kjbekkelund/karma-requirejs/blob/master/test/appSpec.js), with some changes to use Chai's syntax instead of Jasmine's (and requiring Lo-Dash instead of Underscore):

* `vim src/appSpec.js`

    ```javascript
    define(['app', 'jquery', 'lodash'], function(App, $, _) {
      describe('just checking', function() {

        it('works for app', function() {
          var el = $('<div></div>');

          var app = new App(el);
          app.render();

          expect(el.text()).to.equal('require.js up and running');
        });

        it('works for lodash', function() {
          expect(_.size([1,2,3])).to.equal(3);
        });

      });
    });
    ```

Note that we are accessing 'describe' and 'expect' globally since they've been bound to the 'window' in their respective Karma plugin files. Our modules and dependencies, though, are pulled in via RequireJS.

# Bringing in Chai, a caveat, and the bacon

So now we're just one step away from running our tests on Karma with this set-up. We still haven't installed Chai and set it up in our Karma config, so go ahead and do that now:

1. `npm i --save-dev karma-chai chai`
2. `vim karma.conf.js`

    ```javascript
    frameworks: ['mocha', 'requirejs', 'chai'],
    ```

**Note:** the order you list the plugins is important. Put 'chai' after 'requirejs'. When I switch these around (as I had done originally), I get:

> Uncaught TypeError: Cannot read property 'should' of undefined

>   at /Users/justin/tmp/setting-up-karma/node\_modules/karma-chai/adapter.js:4

I found this out thanks to: https://github.com/xdissent/karma-chai/issues/5

Anyway, although it took longer than I would have liked (missing the 'lib/\*\*/\*.js' loading in karma.conf.js tripped me up quite a bit), we can kick off Karma with `karma start` and leave it running while we develop our tests and have them executed in real, possibly multiple, browsers.

The repo for this example is up on [Github](https://github.com/justin-calleja/setting-up-karma-with-mocha-chai-requirejs "setting-up-karma-with-mocha-chai-requirejs") - remember to get the dependencies: `npm install && bower install`. I have added the following two files to this repo which we haven't talked about yet. Again they are based off of the ones in the [karma-requirejs](https://github.com/kjbekkelund/karma-requirejs "karma-requirejs") example but adapted a bit for this example:

* `vim index.html`
  ``` xml
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Karma example setup with Require.js</title>
      <script data-main="src/main.js" src="lib/requirejs/require.js"></script>
    </head>

    <body>
    </body>
  </html>
  ```

* `vim src/main.js`
  ``` javascript
  requirejs.config({
      paths: {
          'jquery': '../lib/jquery/dist/jquery',
          'lodash': '../lib/lodash/dist/lodash'
      }
  });

  define(['app', 'jquery', 'lodash'], function (App, $, _) {
      var app = new App($('body'));
      app.render();
      console.log(_.size([1,2,3]));
  });
  ```

If you open up index.html in a browser you should get the text "require.js up and running" and "3" in the console. This is using the RequireJS we pulled in via Bower.


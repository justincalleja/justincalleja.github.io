---
date: "2015-01-18"
title: "Grunt watch those templates"
tags: [ "grunt" ]
categories: [ "programming" ]
tocEnabled: true

---

# Purpose

Setting up automatic [EJS](http://www.embeddedjs.com/ "Embedded JS") (Underscore/Lo-Dash) and [Handlebars](http://handlebarsjs.com/ "Handlebars") template compilation in [Grunt](http://gruntjs.com/ "Grunt") using [grunt-contrib-watch](https://github.com/gruntjs/grunt-contrib-watch "grunt-contrib-watch").

The aim is to be able to spawn a process which will watch our templates and compile them to JST (Javascript template) files while we're editing them. That way we can write our templates in a more readable fashion but use the actual JST files at runtime (thus avoiding the need to compile them dynamically).

# Starting to watch

`cd` into an empty directory and:

``` bash
$ npm init
$ npm i --save-dev grunt grunt-contrib-jst grunt-contrib-watch load-grunt-tasks grunt-contrib-handlebars
$ mkdir -p app/scripts
```

Start the Gruntfile.js configuration with the following, just to check that watch is working:

`vim Gruntfile.js`

```javascript
'use strict';

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    watch: {
      options: {
        nospawn: true
      },
      log: {
        files: [
          'app/scripts/**/*.js'
        ],
        tasks: ['tmpLog']
      }
    }
  });

  grunt.registerTask('tmpLog', function () {
    grunt.log.write('watchin is workin');
  });

};
```

Running `grunt watch` and editing a JS file in _'app/scripts/\*\*/\*.js'_ (e.g. _app/scripts/tmp.js_) should give the following output:

{% asset_img watch-is-working.png [Screenshot showing that watch is set up] %}

# Compiling EJS templates

Replace watch's `log` option with the following:

```javascript
jst: {
  files: [
    'app/scripts/templates/ejs/**/*.ejs'
  ],
  tasks: ['jst:compile']
}
```

Configure JST compilation for EJS files with the following (don't include *amd: true* if you're not working with an AMD module loader like RequireJS):

```javascript
jst: {
  options: {
    amd: true
  },
  compile: {
    files: {
      'app/scripts/templates/jst/ejsTemplates.js': ['app/scripts/templates/ejs/**/*.ejs']
    }
  }
}
```

Personally, I find using `jst` for the key a bit confusing. The way I understand it is that both *grunt-contrib-jst* and *grunt-contrib-handlebars*, as well as any other JST compiler, compiles some kind of template file to a Javascript file in order to make the authoring and maintaing of these JST files easier (since these Javascript files tend to be heavy on string concatenation and such).

Since *grunt-contrib-jst* compiles [EJS](http://www.embeddedjs.com/ "Embedded JS") templates, it seems to me that it would have made more sense to call the plugin *grunt-contrib-ejs* and to use *ejs* as the key to configure this plugin in *grunt.initConfig*. But the key to use for the plugin is `jst`, so I'm also sticking to `jst` in the *watch* plugin configuration. I will, however, be suffixing these template files with *.ejs*, hence the above configuration.

Running `grunt watch` and editing an EJS file in our watched path should trigger the compilation, e.g:

`vim app/scripts/templates/ejs/tmp.ejs`

```ejs
<ul>
    <% for(var i=0; i<supplies.length; i++) { %>
        <li>
            <a href='supplies/<%= supplies[i] %>'>
                <%= supplies[i] %>
            </a>
        </li>
    <% } %>
</ul>
```

# Compiling Handlebars templates

Add the following option to the *watch* task configuration:

```javascript
handlebars: {
  files: [
    'app/scripts/templates/hbs/**/*.hbs'
  ],
  tasks: ['handlebars:compile']
}
```

Then configure the *grunt-contrib-handlebars* plugin itself (again, I want the generated JST file to be wrapped in an AMD define, YMMV):

```javascript
handlebars: {
  options: {
    amd: true
  },
  compile: {
    files: {
      'app/scripts/templates/jst/hbsTemplates.js': ['app/scripts/templates/hbs/**/*.hbs']
    }
  }
}
```

Try it out:

`vim app/scripts/templates/hbs/tmp.hbs`

```handlebars
<div class="entry">
  <h1>{{title}}</h1>
  <div class="body">
    {{body}}
  </div>
</div>
```

... and assuming you've restarted `grunt watch` and it's running in the background, you should get *hbsTemplates.js*.

# Final Gruntfile.js

```javascript
'use strict';

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({

    watch: {
      options: {
        nospawn: true
      },
      jst: {
        files: [
          'app/scripts/templates/ejs/**/*.ejs'
        ],
        tasks: ['jst:compile']
      },
      handlebars: {
        files: [
          'app/scripts/templates/hbs/**/*.hbs'
        ],
        tasks: ['handlebars:compile']
      }
    },

    jst: {
      options: {
        amd: true
      },
      compile: {
        files: {
          'app/scripts/templates/jst/ejsTemplates.js': ['app/scripts/templates/ejs/**/*.ejs']
        }
      }
    },

    handlebars: {
      options: {
        amd: true
      },
      compile: {
        files: {
          'app/scripts/templates/jst/hbsTemplates.js': ['app/scripts/templates/hbs/**/*.hbs']
        }
      }
    }

  });

};
```

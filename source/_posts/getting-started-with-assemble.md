---
date: "2015-01-10"
title: "Getting started with Assemble"
tags: [ "node", "assemble", "grunt" ]
categories: [ "programming"]

---

<!-- toc -->

Version of Assemble at time of writing: 0.4.42

If you want to follow along with the end result at hand, the repo is up on [Github](https://github.com/justin-calleja/getting-started-with-assemble "getting-started-with-assemble").

# Intro

[Assemble](https://github.com/assemble/assemble "Assemble"), in their own words, is a static site generator for Grunt.js, Yeoman and Node.js. This blog post is a record of the approach taken and material covered during my first time usage of Assemble.

## grunt-init-assemble

The first approach I took was to have a go at the [grunt-init](https://github.com/gruntjs/grunt-init "grunt-init") template for Assemble, [grunt-init-assemble](https://github.com/ghost-town/grunt-init-assemble "grunt-init-assemble"):

1. `npm i -g grunt-cli grunt-init` if you don't already have them installed.
2. `git clone https://github.com/ghost-town/grunt-init-assemble ~/.grunt-init/assemble`
  * Allows us to scaffold a new Assemble project using grunt-init.
3. cd into an empty directory and `grunt-init assemble`
  * This will look in ~/.grunt-init by default.
4. `npm install && bower install` to bring in Node and Bower packages.
5. `grunt setup` runs a task which is defined in the generated Gruntfile.js.
6. Go though your Gruntfile.js and delete the sections marked for deletion in the comments (they were there just for running `grunt setup` and should be removed after executing this task).

This leaves us with a bootstrapped Assemble project. If you're not familiar with Assemble, it's a good idea to have a look at the generated project. The rest of this post builds an example project from scratch i.e. without starting off using *grunt-init-assemble*, however, I am using the generated project as a guide - "cherry picking" if you will.

# Starting from scratch

The idea is to run Assemble as part of a [Grunt](http://gruntjs.com/ "Grunt") build and end up with a page assembled from bits and pieces with the help of Assemble. Along the way, we'll be taking a look at what goes in to working with an Assemble project.

## \_config.yml and Gruntfile.js

1. `npm init && npm i --save-dev grunt grunt-contrib-clean assemble`
2. `vim _config.yml`
```json
root:             public
dest:             <%= site.root %>
assets:           <%= site.dest %>/assets

data:             data/*.{json,yml}

templates:        templates
includes:         <%= site.templates %>/includes/*.hbs
layouts:          <%= site.templates %>/layouts
layout:           default.hbs

helpers:          
  - <%= site.templates %>/helpers/*.js

description:      <%= pkg.description %>
```

Apart from pulling in some dependencies we're setting up a \_config.yml from which we'll be accessing values to set up our Assemble configuration in the Gruntfile. Speaking of which, lets get a minimal Gruntfile in place. From the snippet below, notice how the *site* variable references the object built from parsing \_config.yml. So when used in \_config.yml above, you can think of *site* as being sort of like *this*, a reference to itself - again I am basing my approach off of the grunt-init-assemble example above.

`vim Gruntfile.js`
```javascript
module.exports = function(grunt) {
'use strict';

  // Project configuration.
  grunt.initConfig({

    // Project metadata
    pkg   : grunt.file.readJSON('package.json'),
    site  : grunt.file.readYAML('_config.yml'),

    // Before generating any new files, remove files from previous build.
    clean: {
      example: ['<%= site.dest %>/*']
    },

    // Build output from templates and data
    assemble: {
      options: {
        flatten: true,
        production: false,
        assets: '<%= site.assets %>',

        // Metadata
        pkg: '<%= pkg %>',
        site: '<%= site %>',
        data: ['<%= site.data %>'],

        // Templates
        partials: '<%= site.includes %>',
        layoutdir: '<%= site.layouts %>',
        layout: '<%= site.layout %>',

        // Extensions
        helpers: '<%= site.helpers %>'
      },
      example: {
        files: {
          '<%= site.dest %>': ['<%= site.templates %>/example.hbs']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('assemble');

  grunt.registerTask('default', ['clean', 'assemble']);

};
```

As you can see, we're freely making use of the *site* and *pkg* variables in both \_config.yml and Gruntfile.js, accessing them within [Lo-Dash](https://lodash.com/ "Lo-Dash") / [Underscore](http://underscorejs.org/ "Underscore") templating.

## Layouts and Partials

Next we'll create the *layoutdir* and *partials* directories which will house our [layouts](http://assemble.io/docs/Layouts.html) and [partials](http://assemble.io/docs/Partials.html) respectively. A layout is a full page with placeholders to fill in. Partials are re-usable parts of pages which can be included within other pages.

The [Assemble](http://assemble.io/docs/) documentation lists both *layouts* and *partials*, along with some other concepts, under the "Templates" heading. From this we can assume that all these parts of Assemble can be grouped under the term "Template". Hence, our directory structure will reflect this (plus I'm just copying the grunt-init-assemble project again):

1. `mkdir -p templates/layouts templates/includes`
2. `vim templates/layouts/default.hbs`

    ```markdown
    {{> preamble}}
    ### Begin
    {{> body }}
    ### End
    ```
3. `vim templates/includes/preamble.hbs`

    ```markdown
    {{filename}} is just an example.

    ---

    ```

{% raw %}
As you might have guessed, <code>{{> preamble}}</code> and <code>{{> body}}</code> are placeholders which will get filled in with contents from other files, as we'll see later on. <code>{{filename}}</code> is a variable which will resolve to the name of the file being generated.
{% endraw %}

## The example.hbs page

Lets now fill in another missing piece from our Grunt configuration, the *example.hbs* file. Note the *example* target in the *assemble* [multi task](http://gruntjs.com/creating-tasks). In the *example* target we are specifying that we want a file to be generated from `['<%= site.templates %>/example.hbs']` i.e. from *templates/example.hbs*.  Of course, we could have added more input files in the array and/or made use of [globbing patterns](http://gruntjs.com/configuring-tasks#globbing-patterns) to match multiple files - but lets keep things simple.

1. `echo "testing testing" > templates/example.hbs`
2. `grunt`
  * Note, you will need to install *grunt-cli* globally if you don't already have it: `npm i -g grunt-cli`

Assuming the directory *public* does not already exist, the file *public.html* is created. If the *public* directory exists when you run the Assemble build, then *public/example.html* is created. I find this a bit confusing so I prefer to explicitly name the generated file in the *assemble.example* target like so:

```javascript
// ...
      example: {
        files: {
          '<%= site.dest %>/example': ['<%= site.templates %>/example.hbs']
        }
      }
```

I exclude the file extension because it is not picked up from here. The *ext* option is used for this. *assemble.options* configures the global settings for the *assemble* target. These are settings which will apply to all targets in this task unless the task itself overwrites certain settings, like so:

```javascript
// ...
      example: {
        options: {
          ext: '.md'
        },
        files: {
          '<%= site.dest %>/example': ['<%= site.templates %>/example.hbs']
        }
      }
```

Up until now, because we weren't specifying the 'ext' option globally, the default *'.html'* has always been applied. However, since we're now overwritting this option at the target level, running `grunt` gives us *public/example.md* with the contents shown below: 

```md
example.md is just an example.

---


### Begin
testing testing

### End
```

{% raw %}
<code>{{> preamble}}</code> in default.hbs was substituted with the contents of the preamble.hbs partial and <code>{{> body}}</code> was substituted with the contents of example.hbs, the page that was rendered using the default.hbs layout. 
<br>
Also, there's a small example of using <a href="http://assemble.io/docs/Built-in-Variables.html" target="_blank" rel="external">variables</a> in the preamble partial i.e. <code>{{filename}}</code> which resolves to example.md, the name of the file being generated.
{% endraw %}

## Spicing up example.hbs

Finally, lets change example.hbs and make it slightly more interesting:

`vim templates/example.hbs`

```
    ---
    title: Example
    content: ['content/todo-today.md', 'content/todo-tomorrow.md']
    ---

    ### {{title}}

    {{site.description}}
    {{#each content}}
    {{str this}}
    {{/each}}
```

The file starts out by defining two variables, *title* and *content*, in the [YAML front matter](http://assemble.io/docs/YAML-front-matter.html "YAML front matter"). Both these variables, as well as the *site* variable defined in our Gruntfile, are used in the page. You will want to make sure your package.json has a value for the *description* key if you want anything to show up for {% raw %}<code>{{site.description}}</code>{% endraw %}. In my case, I have: 

```json
"description": "This is a dummy project meant to explore Assemble."
```

The *content* variable is being used in a [Handlebars block helper](http://handlebarsjs.com/block_helpers.html "Handlebars block helper") to iterate over its values. {% raw %}<code>{{str}}</code>{% endraw %} is a [custom helper](http://assemble.io/docs/Custom-Helpers.html "custom helper") which just reads the contents of the file whose path is in *this* and includes it in the page being built:

`vim templates/helpers/str.js`
```javascript
var fs = require('fs');

module.exports.register = function (Handlebars, options, params) {
  'use strict';

  Handlebars.registerHelper('str', function(filePath) {
    var res = fs.readFileSync(filePath, 'utf8');
    return new Handlebars.SafeString(res);
  });
};
```

Most likely, there is already a helper which does this for us. I have not yet been through the helpers in the [handlebars-helpers](https://github.com/assemble/handlebars-helpers "handlebars-helpers") project. I figured it was just as well to do this "by hand" so to speak, to at least get some experience doing it and demoing it here.

After filling in our two content files, we can kick off the build process again and get some more interesting results:

`vim content/todo-today.md`
```md
* Finish documenting Assemble findings in blog post
* Answer emails
```
`vim content/todo-tomorrow.md`
```md
* Spend 30 mins on X
* Review this week's progress on Y
```
`grunt && cat public/example.md`
```md
example.md is just an example.

---


### Begin


### Example

This is a dummy project meant to explore Assemble.

* Finish documenting Assemble findings in blog post
* Answer emails


* Spend 30 mins on X
* Review this week's progress on Y



### End
```

A bit more whitespace than I would have liked, but given how customizable all this seems to be, something can most likely be done about that (or maybe pass the output through some kind of postprocessing).

If you've used Assemble before and know how this can be improved (in general, but specifically the {% raw %}<code>{{str}}</code>{% endraw %} and whitespace parts), please leave a comment below. I will update and give attribution. Thanks!


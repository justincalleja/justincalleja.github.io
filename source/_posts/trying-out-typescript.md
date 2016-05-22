---
date: "2016-05-22"
title: "Trying out Typescript"
tags: [ "typescript", "node", "redis" ]
categories: [ "programming" ]
tocEnabled: true

---

# Intro

The intention was to write some demo code to see what problems I come across while just starting to use [Typescript](https://www.typescriptlang.org/), and to document the "work-arounds" along the way. This is a suitable read for anyone who knows what Typescript is, is interested in it, but hasn't really used it before. You should have [Redis](http://redis.io/) installed (as well as Node and Typescript) to follow along.

I'm using the [Atom](https://atom.io/) text editor with the [atom-typescript](https://github.com/TypeStrong/atom-typescript) package.

# The demo

We're going to have 2 scripts to run, `pub.js` and `sub.js`. `pub.js` will just start up a Node [REPL](https://nodejs.org/api/repl.html) exposing a `redisClient` which we can use to publish messages on channels with. `sub.js` will be subscribing to channels and listening to messages published by `pub.js`.

Below is a quick session for illustration:

![pub.js](pub.png "pub.js")

![sub.js](sub.png "sub.js")

Simple, but making the compiler happy took a bit of playing around.

# Coding it

## tsconfig.json

```bash
$ mkdir redis-ts-eg && cd redis-ts-eg
redis-ts-eg$ npm init --yes
redis-ts-eg$ npm i -S redis
redis-ts-eg$ mkdir src lib
```

If you now open `redis-ts-eg` in Atom and create `pub.ts` (note the `ts` extension) in `src`, you should get the following error (and suggestion):

![missing-tsconfig](missing-tsconfig.png "missing-tsconfig")

We're missing a [tsconfig.json](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) [file](https://github.com/TypeStrong/atom-typescript/blob/master/docs/tsconfig.md) and we can get [atom-typescript](https://github.com/TypeStrong/atom-typescript) to create one for us using the Atom [command-palette](https://atom.io/packages/command-palette) by hitting `cmd-shift-p` (OSX) or `ctrl-shift-p` (Linux/Windows).

Once you have that open, start typing "create tsconfig.json" and you should get the option to select. This creates the file in `src`, so just move it one directory up to the project root.

So what is `tsconfig.json` anyway?

<blockquote>A unified project format for TypeScript… The TypeScript compiler (1.5 and above) only cares about *compilerOptions* and *files*<footer><cite><a href="https://github.com/TypeStrong/atom-typescript/blob/master/docs/tsconfig.md#tsconfigjson">tsconfig.json atom-typescript doc</a></cite></footer></blockquote>

Ok, so [compilerOptions](https://www.typescriptlang.org/docs/handbook/compiler-options.html) and *files* are passed to the Typescript compiler, but this isn't to say that `tsconfig.json` is an [atom-typescript](https://github.com/TypeStrong/atom-typescript) only thing:

<blockquote>
Using tsconfig.json:

<ul><li>By invoking tsc with no input files, in which case the compiler searches for the tsconfig.json file starting in the current directory and continuing up the parent directory chain.</li><li>By invoking tsc with no input files and a --project (or just -p) command line option that specifies the path of a directory containing a tsconfig.json file.</li></ul>When input files are specified on the command line, tsconfig.json files are ignored.
<footer><cite><a href="https://www.typescriptlang.org/docs/handbook/tsconfig-json.html">tsconfig.json Typescript doc</a></cite></footer></blockquote>

i.e. both Typescript and atom-typescript use the file (the teams behind each collaborate to avoid conflicts). 

In `tsconfig.json`, [filesGlob](https://github.com/TypeStrong/atom-typescript/blob/master/docs/tsconfig.md#filesglob) is a field used by atom-typescript to keep `files` up to date. i.e. any files matched by `filesGlob` are automatically (and individually) listed by Atom in `files` (which *is* used by `tsc`, the Typescript compiler).

```json
"filesGlob": [
    "**/*.ts",
    "**/*.tsx",
    "!node_modules/**"
],
```

## typings

Great, so I guess we're ready to start coding now:

```ts
import redis = require('redis');
```

![Cannot find module 'redis'](cannot-find-redis.png)

Not so fast. We're importing `redis` (Typescript style) but the compiler knows nothing about it. To fix this we'll use [typings](https://github.com/typings/typings), the Typescript Definition Manager, to fetch a description of what the `redis` module is (i.e. a `.d.ts` file).

```bash
redis-ts-eg$ # Install Typings CLI utility if you don't already have it
redis-ts-eg$ npm install typings --global
redis-ts-eg$ typings search redis
Viewing 5 of 5

NAME            SOURCE HOMEPAGE                                    DESCRIPTION VERSIONS UPDATED
node_redis      dt     https://github.com/mranney/node_redis                   1        2016-03-16T15:55:26.000Z
redis           npm    https://www.npmjs.com/package/redis                     1        2016-05-02T17:09:35.000Z
redis           dt     https://github.com/mranney/node_redis                   1        2016-03-16T15:55:26.000Z
socket.io-redis dt     https://github.com/socketio/socket.io-redis             1        2016-04-01T04:54:12.000Z
ioredis         dt     https://github.com/luin/ioredis                         1        2016-05-21T15:26:53.000Z
```

You can tell typings to install from one of these [sources](https://github.com/typings/typings#sources) (assuming a type definition is available at a given source - something you can confirm through searching as done above). `npm` is the default (configurable through `defaultSource` in `.typingsrc`).

```bash
redis-ts-eg$ typings install redis --save
```

After installing, you should get a `typings.json` file and a `typings` directory. If you save `tsconfig.json` now, it should update files to:

```json
"files": [
    "src/pub.ts",
    "typings/index.d.ts",
    "typings/modules/redis/index.d.ts"
],
```

It would work just as well without `typings/modules/redis/index.d.ts` as `typings/index.d.ts` references it. In any case, the "Cannot find module 'redis'" error should be gone now (try closing and re-opening the file if not).




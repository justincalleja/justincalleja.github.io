---
title: Using plain pg with Nest.js
date: 2020-03-26 14:19:25
tags: [ "node", "nestjs", "pg"]
categories: [ "programming"]
tocEnabled: true

---

## Intro

This is going to be a quick demo of how to get started using plain [pg (node-postgres)](https://node-postgres.com/) with [Nest.js](https://nestjs.com/) — no ORMs in sight. Having found no simple guide on how to do this when I was looking for it — I figured it’d be worth writing about.

## Demo on Github:

[https://github.com/justin-calleja/nest-pg-demo](https://github.com/justin-calleja/nest-pg-demo)

## Using plain pg with Nest.js

### Create a new Nest.js app — install pg — generate db module

```bash
npx nest new nest-pg-demo
cd nest-pg-demo
npm i pg
npx nest g module db
```

### Register a Provider

We’ll use a constants.ts file in /src to be able to import the DI token for our postgres connection (or pool of connections):

```ts
// src/constants.ts
export const PG_CONNECTION = 'PG_CONNECTION';
```

The DI token (dependency injection token) is how you’ll declaratively tell the [Inversion of Control (IoC)](https://en.wikipedia.org/wiki/Inversion_of_control) container which dependency you’d like injected. So you’ll use it to pull in a dependency from the container.

You’ll also use it when you register a provider with the container. Registering a provider is basically associating a DI token (which will be a string in our case) with a way to get a dependency. The container will use this "way to get a dependency" when you request the relevant dependency be injected.

Registering a provider looks like this:

```ts
import { Module } from '@nestjs/common';
import { PG_CONNECTION } from '../constants';

const dbProvider = {
    provide: PG_CONNECTION,
    // useValue / useFacotry / useClass: …
};

@Module({
    providers: [dbProvider],
})
export class DbModule {}
```

i.e. we need an object with the DI token and the way to get the dependency — the dbProvider — and pass it to **providers** in the Module configuration as shown above.

There’s a couple of ways to specify how to get the dependency in Nest.js. We’ll be using [useValue](https://docs.nestjs.com/fundamentals/custom-providers#value-providers-usevalue):

```ts
import { Pool } from 'pg';
const dbProvider = {
  provide: PG_CONNECTION,
  useValue: new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'somedb',
    password: 'meh',
    port: 5432,
  }),
};
```

Finally, we’ll also include the dbProvider in the DbModule’s exports so we’ll be able to use it in other modules importing `DbModule`:

```ts
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../constants';

const dbProvider = {
    provide: PG_CONNECTION,
    useValue: new Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'somedb',
        password: 'meh',
        port: 5432,
    })
};

@Module({
    providers: [dbProvider],
    exports: [dbProvider],
})
export class DbModule {}
```

### Use the Provider

You’ll notice that the `AppModule` is already importing `DbModule` (at least if you generated DbModule with the `nest cli` that should be the case):

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';

@Module({
  imports: [DbModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

This means that — in our AppModule i.e. in e.g. controllers and providers defined as part of AppModule) we’ll be able to ask Nest’s IoC container to inject a connection for us using the `PG_CONNECTION` DI token (string).

Doing so in our `AppService` looks something like this:

```ts
// src/app.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PG_CONNECTION } from './constants';

@Injectable()
export class AppService {
  constructor(@Inject(PG_CONNECTION) private conn: any) {}

  async getUsers() {
    const res = await this.conn.query('SELECT * FROM users');
    return res.rows;
  }
}
```

Notice that we annotate `conn` with `Inject` and make it private in the `constructor`. This is significant at it allows Nest to know that *it* should be the one to supply a value for `conn` and it also knows what to inject via the DI token.

`getUsers` is just a simple query to use as a sanity check. We’ll use it in `AppController`:

```ts
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('users')
  getUsers() {
    return this.appService.getUsers();
  }
}
```

I guess you might be wondering how we’re able to inject `AppService` here without the `Inject` annotation… That’s thanks to a shortcut (or "syntactic sugar" if you prefer). In Nest.js, registering a Provider with a class name:

```ts
import { AppService } from './app.service';
@Module({
  providers: [AppService],
})
export class AppModule {}
```

… is equivalent to:

```ts
import { AppService } from './app.service';
@Module({
  providers: [{
    provider: AppService,
    useClass: AppService,
  }],
})
export class AppModule {}
```

… which means — the DI token doesn’t have to be a string and now Nest.js knows what to inject when we type the `private appService` in `AppController` with the type `AppService`.

### Start and seed postgres

Of course, you’re going to want postgres running if you want to try this out. If you have docker installed, take a look at the `scripts` and `sql` directories in the [repo](https://github.com/justin-calleja/nest-pg-demo) for this demo — but the gist is:

```sh
#!/bin/bash
docker run --rm \
    --name somedb \
    -e POSTGRES_PASSWORD=meh \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=somedb \
    -p 5432:5432 \
    -v somedb-vol:/var/lib/postgresql/data \
    postgres
```

`scripts/start-db.sh` starts postgres. `--rm` will remove the container when we stop it. By virtue of passing in the env vars we do — the container will auto create the somedb database. The volume mapping is so we keep our data even when we stop the container (and have it auto-removed).

After the db is up — you can run `scripts/sync-db.sh`:

```sh
#!/bin/bash
SCRIPTS_DIR=`dirname "$0"`
cat "$SCRIPTS_DIR/../sql/schema.sql" "$SCRIPTS_DIR/../sql/dev-seeds.sql" \
    | psql -U postgres -d somedb -p 5432 -h localhost -1 -f -
```

This should work regardless of your `pwd` when you run the script since we’re referencing the sql files relative to the location of the `sync-db.sh` file on disk (consider this to be an equivalent of `__dirname` in Node.js). Since `schema.sql` drops and re-creates the public schema every time — it’s safe to re-run `sync-db.sh` when you change your table definitions etc…

### Start the app and GET /users

Finally, it’s time to run our app with `npm run start:dev` and hit the `/users` endpoint with:

```sh
curl localhost:3000/users
[{"id":1,"email":"tmp@gmail.com"},{"id":2,"email":"user@gmail.com"},{"id":3,"email":"anotheruser@gmail.com"}]
```


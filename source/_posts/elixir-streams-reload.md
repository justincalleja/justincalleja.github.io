---
date: "2016-01-02"
title: "Elixir Streams reload"
tags: [ "elixir" ]
categories: [ "programming"]
tocEnabled: true

---

# Intro

This post is based on [Drew Olson](http://drewolson.org/)'s [Elixir Streams](http://blog.drewolson.org/elixir-streams/). Since I'm just getting started with [Elixir](http://elixir-lang.org/), I came across a few issues understanding the ["Building an API with Streams"](http://blog.drewolson.org/elixir-streams/#buildinganapiwithstreams) section in Drew's post. This post is my attempt at breaking it down while learning about Elixir.

I'm using [Elixir](http://elixir-lang.org/) 1.2.0 (and [Erlang](http://www.erlang.org/) 18.1).

## Worth mentioning (I guess…)

* I will not be using the exact Github endpoint (e.g. https://github.com/api/v3/orgs/elixir-lang/repos) used in Drew's post because:
  * I'm not familiar with the Github API
  * Couldn't get the given endpoint to work after generating an access token
  * Got the data I wanted anyway using the endpoint in this post (no need for access tokens)
  * It cuts down on code :)
* This post is primarily a "learning devise", by which I mean I intend to side track from the main intention below to explain (or mention and link to) Elixir basics. i.e. this post is not really about Elixir Streams although it features them. The original idea for this post was to learn some Elixir basics in the context of the app in Drew's ["Building an API with Streams"](http://blog.drewolson.org/elixir-streams/#buildinganapiwithstreams) section.
* Code example in the "Building an API with Streams" section in Drew's post has been tweaked to work with Elixir version 1.2.0.

# The intention

We want to write an Elixir module to expose an Elixir based API around the [Github REST API](https://developer.github.com/v3/) in such a way as to hide pagination from users of our API. Our API will give users [stream](http://elixir-lang.org/docs/v1.2/elixir/Stream.html)s to work with. As we'll see, this means we never hit Github unless the user actually reads from the stream, and we only paginate as much as necessary (depending on how much the user reads from the stream and how many pages Github has for the particular resource).

It's probably best to go over this intention in more detail.

## How to fetch Github organization repos and their pagination

We will only be concerned with a single endpoint from Github's API in this post, namely, *listing the repositories of a specific organization*. So lets start off with the [elixir-lang](https://github.com/elixir-lang) organization. If you open the following in a browser: [https://api.github.com/orgs/elixir-lang/repos](https://api.github.com/orgs/elixir-lang/repos), you should get back something like:

```json
[
  {
    "id": 1234714,
      "name": "elixir",
      "full_name": "elixir-lang/elixir",
      ...
  },
  {
    "id": 1467845,
    "name": "elixir-tmbundle",
    "full_name": "elixir-lang/elixir-tmbundle",
    ...
  },
  ...
]
```

Opening your browser's dev tools, you'll also be able to look at the HTTP response headers from the API (or `curl -i https://api.github.com/orgs/elixir-lang/repos | less` if you're on a Unixy system). At the time of writing, you will see that there is no `Link` header for `elixir-lang` as it hasn't got enough repos to necessitate pagination.

Maybe there's a parameter to limit the number of returned repos - in which case, you'd be able to trigger pagination like that. But I'm too lazy to look into that so I'll just pick something like: [https://api.github.com/orgs/nodejs/repos](https://api.github.com/orgs/nodejs/repos), which gives back this `Link` header:

```
Link: <https://api.github.com/organizations/9950313/repos?page=2>; rel="next",
      <https://api.github.com/organizations/9950313/repos?page=3>; rel="last"
```

Using a tool like [jq](https://stedolan.github.io/jq/), we can easily count how many repos we just got back:

```
$ curl -s "https://api.github.com/orgs/nodejs/repos" | jq '. | length'
30
```

So now we know that we'll only ever get a maximum of 30 repos for each such request we make to Github. If the organization happens to have more than 30 repos, we'll need to follow the link with `rel="next"`, and so on, until there are no more repos to get - i.e. we need to paginate.

*But*, we don't want to paginate unless the user actually wants more data - which is why we give the user a stream.

## Quick intro to streams

The thing about streams is… they're lazy… and they're enumerable.

[Stream](http://elixir-lang.org/docs/v1.2/elixir/Stream.html) the Elixir module, like the [Enum](http://elixir-lang.org/docs/v1.2/elixir/Enum.html) module, works on [Enumerable](http://elixir-lang.org/docs/v1.2/elixir/Enumerable.html) things. But a stream itself is some kind of data structure which implements the Enumerable [protocol](http://elixir-lang.org/getting-started/protocols.html) (making it an Enumerable thing). This means that streams, like other Enumerables, [implement](https://github.com/elixir-lang/elixir/blob/v1.2/lib/elixir/lib/stream.ex#L1222-L1238):

* Enumerable.count/1
* Enumerable.member?/2
* Enumerable.reduce/3

just like all the following Enumerables (checkout [elixir](https://github.com/elixir-lang/elixir)):

```
~/github-stuff/elixir$ egrep -R -n --exclude-dir={bin,\.git} ".*defimpl Enumerable.*" .
./lib/elixir/lib/enum.ex:2748:defimpl Enumerable, for: List do
./lib/elixir/lib/enum.ex:2760:defimpl Enumerable, for: Map do
./lib/elixir/lib/enum.ex:2783:defimpl Enumerable, for: Function do
./lib/elixir/lib/file/stream.ex:68:  defimpl Enumerable do
./lib/elixir/lib/gen_event/stream.ex:58:defimpl Enumerable, for: GenEvent.Stream do
./lib/elixir/lib/hash_dict.ex:220:defimpl Enumerable, for: HashDict do
./lib/elixir/lib/hash_set.ex:235:defimpl Enumerable, for: HashSet do
./lib/elixir/lib/io/stream.ex:49:  defimpl Enumerable do
./lib/elixir/lib/map_set.ex:266:  defimpl Enumerable do
./lib/elixir/lib/range.ex:66:defimpl Enumerable, for: Range do
./lib/elixir/lib/stream.ex:1222:defimpl Enumerable, for: Stream do
```

That's great, but maybe not so practical right now. Let's focus on the **lazy** property of streams which is what we'll leverage to paginate on an "as-needed" basis.

Being lazy, you can define any transformation you want on streams using the API in the [Stream](http://elixir-lang.org/docs/v1.2/elixir/Stream.html) module, but doing so will **not** trigger the stream's enumeration. This means that "nothing" will actually happen when you define a stream or make one from another using the Stream module's API.

Consider the following (adapted from the [online doc](http://elixir-lang.org/docs/v1.2/elixir/Stream.html#map/2)):

```elixir
iex(1)> stream = Stream.map([1, 2, 3], fn(x) -> IO.puts "x is #{x}"; x * 2 end)
#Stream<[enum: [1, 2, 3], funs: [#Function<44.120526864/1 in Stream.map/2>]]>
iex(2)> Enum.to_list(stream)
x is 1
x is 2
x is 3
[2, 4, 6]
```

In our first expression (`iex(1)>`), we are creating a stream from a list and a function, using [Stream.map/2](http://elixir-lang.org/docs/v1.2/elixir/Stream.html#map/2). The REPL shows us that we got back a stream from `Stream.map/2`. It shows us a human readable string [based on](https://github.com/elixir-lang/elixir/blob/v1.2/lib/elixir/lib/stream.ex#L1268-L1274) the [Inspect](http://elixir-lang.org/docs/v1.2/elixir/Inspect.html) protocol. As a side note:

<blockquote>Keep in mind that, by convention, whenever the inspected value starts with #, it is representing a data structure in non-valid Elixir syntax.<footer><cite><a href="http://elixir-lang.org/getting-started/protocols.html">Protocols</a></cite></footer></blockquote>

In other words, the `stream` variable is now bound to a stream - "some kind of data structure" - the innards of which you should make no assumptions on (as they *might* change in different versions of Elixir).

In our second expression (`iex(2)>`), we're using [Enum.to\_list/1](http://elixir-lang.org/docs/v1.1/elixir/Enum.html#to_list/1) to convert the stream data structure to an Erlang/Elixir list. On doing so, `to_list/1` is internally calling [Enumerable.reduce/3](http://elixir-lang.org/docs/v1.2/elixir/Enumerable.html#reduce/3) on the stream we pass to it which will "force" the lazy stream to produce something. In the case of `to_list/1`, the stream is "forced" to keep producing values until it's exhausted.

That is why we don't see the side effect of printing to stdout until we actually trigger the stream's enumeration.

Of course, we don't *have* to exhaust the stream. We can just take what we want from it, e.g. using [Enum.take/2](http://elixir-lang.org/docs/v1.1/elixir/Enum.html#take/2):

```elixir
iex(3)> Enum.take(stream, 1)
x is 1
[2]
```

But consider this:

```elixir
iex(4)> Enum.take([4, 5, 6], 1)
[4]
```

What's different here? The difference is that the data you `take/2` from `stream` doesn't actually exist until you take it, whereas that from `[4, 5, 6]` exists in memory before ever calling `take/2` on it. Granted, in this case, `stream` is lazily producing data from a list data source which exists in memory (i.e. `[1, 2, 3]`). This might make the distinction a little more nuanced for this particular example, but what's important to keep in mind is that the actual values the `stream` produces (`1`, `2`, and `3`) *don't exist* in memory until the stream is actually consumed. Our `stream` could just as easily be feeding our program data from a database or a REST API instead of an in-memory data structure.

For example, it could be giving `Enum.take/2` data it got from its first HTTP request to Github's REST API. If `take/2` doesn't want more than 30 repos, then `stream` only ever needs to make 1 HTTP request. If `take/2` wants more, `stream` would have to paginate as necessary but at least `take/2` doesn't have to wait until `stream` makes enough requests to exhaust the number of repos for a particular organization before it starts receiving data from `stream`.

That is exactly what we want for the Elixir API we'll be writing.

But first…

# Know your poison

The example coming up next makes use of [HTTPoison](https://github.com/edgurgel/httpoison) as well as the more mainstream (but no less deadly) [Poison](https://github.com/devinus/poison) modules - so it makes sense to cover basic usage of each before digging in.

Bootstrap a new project with `mix new github`; `cd` into it, and add these modules as dependencies in `mix.exs`:

```elixir
  defp deps do
    [{:httpoison, "~> 0.8.0"}, {:poison, "~> 1.5"}]
  end
```

Then run `mix deps.get` to fetch the poisonous bunch.

## HTTPoison

First things first. Unless you fancy manually starting the HTTPoison applicaiton every time you load `iex` (with `HTTPoison.start`), add it as an application in mix.exs:

```elixir
  def application do
    [applications: [:logger, :httpoison]]
  end
```

It seems that some processes need to be running before using HTTPoison and adding `:httpoison` in the `applications` [keyword list](http://elixir-lang.org/getting-started/maps-and-dicts.html#keyword-lists) will automatically make this happen. I'm guessing that modules listed in `applications` have their [start](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L81) function called by [mix](https://github.com/elixir-lang/elixir/tree/master/lib/mix) which then spawn the processes, but I'm not entirely sure how that works.

In HTTPoison's case, Erlang's [application:ensure\_all\_started/1](http://www.erlang.org/doc/apps/kernel/application.html#ensure_started-1) seems to be what's making this happen.

In any case, starting iex and loading our app with [iex -S mix](https://github.com/elixir-lang/elixir/wiki/FAQ#3-how-do-i-start-a-shell-iex-with-my-project-and-all-its-dependencies-loaded-and-started) (which starts a shell with the project and all of its dependencies loaded and started), we can now start experimenting a bit:

```elixir
iex(1)> HTTPoison.get! "https://api.github.com/orgs/elixir-lang/repos"
# ...
```

should give you back a bunch of data with a status code of 200. From the example request in the project's [README.md](https://github.com/edgurgel/httpoison) (and from [this](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison.ex#L2)), we can see that the response we get back is a `HTTPoison.Response` [struct](http://elixir-lang.org/getting-started/structs.html) with an integer `status_code`, a binary `body`, and a list for `headers`:

```elixir
iex(2)> %HTTPoison.Response{body: body, headers: headers, status_code: status_code} = v(1)
# ...
```

Above, we're getting the evaluation of expression 1 in iex (i.e. the result of `iex(1)>`) and extracting its individual parts using [pattern matching](http://elixir-lang.org/getting-started/pattern-matching.html) (we're using the [v(n \\\\ -1)](http://elixir-lang.org/docs/master/iex/IEx.Helpers.html#v/1) iex helper function to do this - and note that the double backslash syntax in the helper function's doc is for [default arguments](http://elixir-lang.org/getting-started/modules.html#default-arguments)). We now have the following bound variables in our iex session: `body`, `headers`, and `status_code`.

Next, add `lib/github_gateway.ex`:

```elixir
defmodule Github.Gateway do
  use HTTPoison.Base

  @endpoint "https://api.github.com"

  def endpoint do
    @endpoint
  end

  defp process_url(url) do
    @endpoint <> url
  end
end
```

There's a couple of things to note here. The easiest to explain is the definition of the `@endpoint` [module attribute](http://elixir-lang.org/getting-started/module-attributes.html#as-constants) which serves as a constant. At compile time, usage of this attribute is changed to the Github endpoint we've set it to.

We're also using `use HTTPoison.Base`, and as we can see from the [online doc](http://elixir-lang.org/getting-started/alias-require-and-import.html#use), this is compiled to something like:

```elixir
defmodule Github.Gateway do
  require HTTPoison.Base
  HTTPoison.Base.__using__ []
  # ...
end
```

<blockquote>Behind the scenes, `use` requires the given module and then calls the `__using__/1` callback on it allowing the module to inject some code into the current context.<footer><cite><a href="http://elixir-lang.org/getting-started/alias-require-and-import.html#use">Getting started guide</a></cite></footer></blockquote>

(note: I'm passing `__using__/1` an empty list as an argument above. This list is an empty [keyword list](http://elixir-lang.org/getting-started/maps-and-dicts.html#keyword-lists), which means that if it weren't empty (i.e. if we had passed any options to the module we were `use`ing), they would be present in this list when the `use` macro is expanded in the form of 2-element tuples with an atom for the first element).

`require`ing seems to be necessary to "guarantee" that `HTTPoison.Base` is available during compilation:

<blockquote>Macros are chunks of code that are executed and expanded at compilation time. This means, in order to use a macro, we need to guarantee its module and implementation are available during compilation. This is done with the `require` directive<footer><cite><a href="http://elixir-lang.org/getting-started/alias-require-and-import.html#require">Getting started guide</a></cite></footer></blockquote>

However, when the compiler is processing this, "code injection" (or "macro expansion") isn't over after just the first step above (the expansion of the `use` macro) because [HTTPoison.Base.\_\_using\_\_/1](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L74) is itself a macro, so it needs to be expanded too.

If you have just a quick look at [HTTPoison.Base.\_\_using\_\_/1](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L74), you'll see that it's defining a bunch of functions within a [quote](http://elixir-lang.org/getting-started/meta/quote-and-unquote.html#quoting) block. Basically, we can write normal Elixir code within `quote` blocks and all that code will be transformed into a data structure which is understood by, and fed to, the Elixir compiler during macro expansion.

Effectively, it's as if the functions in this `quote` block were defined in our module, `Github.Gateway`.

You can confirm this by removing the `use HTTPoison.Base` expression in `Github.Gateway` (or replacing `use` with `require` without calling the `__using__/1` macro). If you then `iex -S mix` and hit the `<TAB>` key after `Github.Gateway.`, it will expand to the only thing available in that module at this point, the public `endpoint` function. If you `use HTTPoison.Base` and try the same thing, you'll get a list of the injected code:

```elixir
iex(1)> Github.Gateway.
delete!/3     delete/3      endpoint/0    get!/3        get/3
head!/3       head/3        options!/3    options/3     patch!/4
patch/4       post!/4       post/4        put!/4        put/4
request!/5    request/5     start/0
```

As you can see, we now have [get!/3](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L194), the same function we used from `HTTPoison` just a minute ago. [In fact](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison.ex#L44-L67):

<blockquote>Under the hood, the [HTTPoison](http://hexdocs.pm/httpoison/HTTPoison.html#content) module just uses [HTTPoison.Base](http://hexdocs.pm/httpoison/HTTPoison.Base.html)… without overriding any default function.<footer><cite><a href="http://hexdocs.pm/httpoison/HTTPoison.html#content">HTTPoison docs</a></cite></footer></blockquote>

However, since we've defined our own `process_url/1` function, we don't need to specify the full URL to make a similar request to the one we've made before:

```elixir
iex(1)> Github.Gateway.get! "/orgs/elixir-lang/repos"
# ...
```

In fact, we *can't* specify the full URL as a parameter since we've changed the [default](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L83-L85) [implementation](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L354-L361) of `process_url/1` to:

```elixir
  defp process_url(url) do
    @endpoint <> url
  end
```

and we'd have an invalid URL if we did.

The HTTPoison documentation is clear about this "overriding" feature:

<blockquote>HTTPoison.Base defines the following list of functions, all of which can be overridden (by redefining them)…<footer><cite><a href="http://hexdocs.pm/httpoison/HTTPoison.Base.html">HTTPoison.Base docs</a></cite></footer></blockquote>

OK… but it's not like this is [OOP](https://en.wikipedia.org/wiki/Object-oriented_programming) and looking into `use`ing a module doesn't explain anything about function overriding. So how does this work?

To better understand what's going on, we need to dig a bit deeper. We know that `HTTPoison.Base.__using__/1` macro is expanded at compile time when `use`ing `HTTPoison.Base`, and if we look into it, we come across this [line](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L329) in the macro's definition:

```elixir
defoverridable Module.definitions_in(__MODULE__)
```

[Module.definitions\_in/1](https://github.com/elixir-lang/elixir/blob/v1.2/lib/elixir/lib/module.ex#L731-L746) is being passed the [\_\_MODULE\_\_/0](http://elixir-lang.org/docs/v1.2/elixir/Kernel.SpecialForms.html#__MODULE__/0) pseudo variable, the evaluation of which seems to be listing all functions defined in `HTTPoison.Base`.

<blockquote>Pseudo variables return information about Elixir’s compilation environment and can only be read, never assigned to.<footer><cite><a href="http://elixir-lang.org/docs/v1.2/elixir/Kernel.SpecialForms.html">Pseudo variables</a></cite></footer></blockquote>

If we now take a look at the [Kernel.defoverridable/1](https://github.com/elixir-lang/elixir/blob/v1.2/lib/elixir/lib/kernel.ex#L3501-L3537) macro, we'll find out that this is what's responsible for the overridability feature:

<blockquote>Makes the given functions in the current module overridable.
An overridable function is lazily defined, allowing a developer to override it.<footer><cite><a href="https://github.com/elixir-lang/elixir/blob/v1.2/lib/elixir/lib/kernel.ex#L3501-L3537">Kernel.defoverridable/1 doc</a></cite></footer></blockquote>

It's also interesting to note the example which comes with the doc for that macro:

``` elixir
defmodule DefaultMod do
  defmacro __using__(_opts) do
    quote do
      def test(x, y) do
        x + y
      end
      defoverridable [test: 2]
    end
  end
end

defmodule InheritMod do
  use DefaultMod
  def test(x, y) do
    x * y + super(x, y)
  end
end
```

Apart from noticing that `defoverridable/1` takes a [keyword list](http://elixir-lang.org/getting-started/maps-and-dicts.html#keyword-lists) as an argument, implying that `Module.definitions_in/1` returns a keyword list, we can see usage of `super` to call the default implementation of `test` in the example.

Lets see this `super` call in action by using it in our `process_url/1`:

```elixir
defp process_url(url) do
  case url |> String.slice(0, 8) |> String.downcase do
    "http://" <> _ -> super url
    "https://" <> _ -> super url
    _ -> @endpoint <> url
  end
end
```

(Read up on the use of the pipe operator, [|>](http://elixir-lang.org/docs/v1.2/elixir/Kernel.html#%7C%3E/2), if you're not familiar with it). Now, both of the following will give us a `200` status code:

```elixir
iex(1)> Github.Gateway.get! "https://api.github.com/orgs/elixir-lang/repos"
# ...
iex(2)> Github.Gateway.get! "/orgs/elixir-lang/repos"
# ...
```

Of course, the same prefix check is happening in [super](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison/base.ex#L354-L361) in this case, but the point is it works as expected.

## Poison

Moving on to [JSON](http://www.json.org/) parsing with [Poison](https://github.com/devinus/poison). We're already depending on it so if we `iex -S mix`, we can start exploring its basic usage (and how to get to specific bits of data):

```elixir
iex(1)> %HTTPoison.Response{ body: body } = Github.Gateway.get! "/orgs/elixir-lang/repos"
# ...
iex(2)> i body
# ...
Data type
  BitString
Byte size
  58284
Description
  This is a string: a UTF-8 encoded binary. It's printed surrounded by
  "double quotes" because all UTF-8 encoded codepoints in it are printable.
iex(3)> parsed_body = Poison.Parser.parse! body
# ...
iex(4)> i parsed_body
# ...
Data type
  List
iex(5)> length parsed_body
12
iex(6)> parsed_body |> List.first |> Map.get("name")
"elixir"
iex(7)> :lists.nth(4, parsed_body)["name"]
"ex_doc"
iex(8)> elixir_repo = parsed_body |> Enum.at(0)
# ...
iex(9)> i elixir_repo
# ...
Data type
  Map
iex(10)> elixir_repo["full_name"]
"elixir-lang/elixir"
iex(11)> [_, _, _, %{ "full_name" => ex_doc_repo_full_name } | _] = parsed_body
# ...
iex(12)> ex_doc_repo_full_name
"elixir-lang/ex_doc"
```

I'm digressing a bit here to show off different ways in which you can manipulate the parsed data:

* `iex(1)` is old news by now, we've already seen that we can do this to get the body of our HTTP request.
* `iex(2)` is using the [i iex helper function](http://elixir-lang.org/docs/v1.2/iex/IEx.Helpers.html#i/1) which shows us that `body` is a BitString.
* `iex(3)` is parsing the `body` with [Poison.Parser.parse!/2](https://github.com/devinus/poison/blob/1.5.2/lib/poison/parser.ex#L48-L58) and binding the result to `parsed_body`. Note: For more info on variable naming conventions and the significance of the "trailing bang" in `Poison.Parser.parse!`, you can read up on these in the [online doc for naming conventions](http://elixir-lang.org/docs/master/elixir/naming-conventions.html).
* `iex(5)` shows us the length of `parsed_body` List via the built-in (i.e. imported by default in your modules and [defined in the Kernel module](https://github.com/elixir-lang/elixir/blob/v1.2.0/lib/elixir/lib/kernel.ex#L440-L454)) [length](http://elixir-lang.org/docs/v1.2/elixir/Kernel.html#length/1) function.
* `iex(6)` is piping to [List.first/1](http://elixir-lang.org/docs/v1.2/elixir/List.html#first/1) to get the first element in `parsed_body` and then piping again to [Map.get/3](http://elixir-lang.org/docs/v1.2/elixir/Map.html#get/3) to get the value for the `"name"` String key. Note that `Map.get/3` has an optional 3rd argument (with a default value) and [|>](http://elixir-lang.org/docs/v1.2/elixir/Kernel.html#%7C%3E/2) is supplying the first argument.
* `iex(7)` is similarly getting the value for the `"name"` String key in the 4th element in `parsed_body` using [Erlang's lists:nth/2](http://www.erlang.org/doc/man/lists.html#nth-2) function. Note that we cannot pipe `parsed_body` into this function as it takes the index for its first argument (as opposed to the List). Also note that the index for `lists:nth/2` starts from 1 not 0.
* `iex(8)` demonstrates another way of picking elements from a list using [Enum.at/3](http://elixir-lang.org/docs/v1.2/elixir/Enum.html#at/3).
* `iex(11)` uses [pattern matching](http://elixir-lang.org/getting-started/pattern-matching.html) to get to the value of the `"full_name"` key in the Map which is the 4th element in the `parsed_body` List.

So we've parsed some JSON into a list of maps and singled out bits of data from it. We're now ready to write that data back out, or "encode" it back to JSON:

```elixir
iex(13)> Poison.encode(elixir_repo)
{:ok,
"{\"teams_url\":\"https://api.github.com/repos/elixir-lang/elixir/teams\",
# ...
iex(14)> elem(Poison.encode(elixir_repo), 1)
"{\"teams_url\":\"https://api.github.com/repos/elixir-lang/elixir/teams\",
# ...
iex(15)> IO.puts elem(Poison.encode(elixir_repo), 1)
{"teams_url":"https://api.github.com/repos/elixir-lang/elixir/teams",
# ...
iex(16)> IO.puts elem(Poison.encode(elixir_repo, [pretty: 2]), 1)
{
  "teams_url": "https://api.github.com/repos/elixir-lang/elixir/teams",
  "branches_url": "https://api.github.com/repos/elixir-lang/elixir/branches{/branch}",
# ...
iex(17)> File.write("./elixir_repo.json", elem(Poison.encode(elixir_repo, [pretty: 2]), 1))
:ok
iex(18)> elixir_repo |> Poison.encode([pretty: 2]) |> elem(1) |> IO.puts
# ... same as iex(16)
```

* `iex(13)` uses [Poison.encode/2](https://github.com/devinus/poison/blob/master/lib/poison.ex#L6-L19) without `options` (thus defaulting to an empty List) to encode the `elixir_repo` Map to JSON. This returns a tuple with `:ok` as the first element and the encoded JSON as the second.
* `iex(14)` uses [elem/2](http://elixir-lang.org/docs/v1.2/elixir/Kernel.html#elem/2) to extract the JSON from the tuple.
* `iex(15)` prints `iex(14)` to stdout.
* `iex(16)` uses the `[pretty: 2]` [option](https://github.com/devinus/poison/blob/1.5.2/lib/poison/encoder.ex#L31-L60) when encoding to print the JSON in a more readable fashion.
* `iex(17)` does the same thing but writes to the `"./elixir_repo.json"` file instead of stdout.
* `iex(18)` is just `iex(16)` using pipes.

While we're at it, and since we have a large enough Map to demo it, consider the following:

```elixir
iex(19)> Map.keys elixir_repo
["statuses_url", "git_refs_url", "issue_comment_url", "watchers", "mirror_url",
 "languages_url", "stargazers_count", "forks", "default_branch", "comments_url",
 "commits_url", "id", "clone_url", "homepage", "stargazers_url", "events_url",
 "blobs_url", "forks_count", "pushed_at", "git_url", "hooks_url", "owner",
 "trees_url", "git_commits_url", "collaborators_url", "watchers_count",
 "tags_url", "merges_url", "releases_url", "subscribers_url", "ssh_url",
 "created_at", "name", "has_issues", "private", "git_tags_url", "archive_url",
 "has_wiki", "open_issues_count", "milestones_url", "forks_url", "url",
 "downloads_url", "open_issues", "keys_url", "description", "contents_url",
 "language", "permissions", "contributors_url", ...]
iex(20)> elixir_repo |> Map.keys |> length
68
iex(21)> Inspect.Opts.__struct__
%Inspect.Opts{base: :decimal, binaries: :infer, char_lists: :infer, limit: 50,
 pretty: false, safe: true, structs: true, width: 80}
iex(22)> Inspect.Opts.__struct__.limit
50
iex(23)> elixir_repo |> Map.keys |> Enum.take(50)
["statuses_url", "git_refs_url", "issue_comment_url", "watchers", "mirror_url",
 "languages_url", "stargazers_count", "forks", "default_branch", "comments_url",
 "commits_url", "id", "clone_url", "homepage", "stargazers_url", "events_url",
 "blobs_url", "forks_count", "pushed_at", "git_url", "hooks_url", "owner",
 "trees_url", "git_commits_url", "collaborators_url", "watchers_count",
 "tags_url", "merges_url", "releases_url", "subscribers_url", "ssh_url",
 "created_at", "name", "has_issues", "private", "git_tags_url", "archive_url",
 "has_wiki", "open_issues_count", "milestones_url", "forks_url", "url",
 "downloads_url", "open_issues", "keys_url", "description", "contents_url",
 "language", "permissions", "contributors_url"]
iex(24)> IEx.configure(inspect: [limit: 70])
:ok
iex(25)> Map.keys elixir_repo
["statuses_url", "git_refs_url", "issue_comment_url", "watchers", "mirror_url",
 "languages_url", "stargazers_count", "forks", "default_branch", "comments_url",
 "commits_url", "id", "clone_url", "homepage", "stargazers_url", "events_url",
 "blobs_url", "forks_count", "pushed_at", "git_url", "hooks_url", "owner",
 "trees_url", "git_commits_url", "collaborators_url", "watchers_count",
 "tags_url", "merges_url", "releases_url", "subscribers_url", "ssh_url",
 "created_at", "name", "has_issues", "private", "git_tags_url", "archive_url",
 "has_wiki", "open_issues_count", "milestones_url", "forks_url", "url",
 "downloads_url", "open_issues", "keys_url", "description", "contents_url",
 "language", "permissions", "contributors_url", "pulls_url", "labels_url",
 "html_url", "svn_url", "issue_events_url", "notifications_url",
 "has_downloads", "compare_url", "full_name", "subscription_url",
 "assignees_url", "issues_url", "size", "has_pages", "fork", "updated_at",
 "branches_url", "teams_url"]
```

* `iex(19)` prints out the keys in the `elixir_repo` Map - but note the trailing ellipsis after the `"contributors_url"` key, i.e. the shell doesn't print all the keys since it is configured to print up to a limit of number of elements for certain data types, such as lists in this case.
* `iex(20)` shows us how many keys the `elixir_repo` Map has (68).
* `iex(21)` shows the current settings of [Inspect.Opts](http://elixir-lang.org/docs/v1.2/elixir/Inspect.Opts.html) which are used by the shell when inspecting values (and "inspecting values" is used when printing our expression results to the shell - and also, for e.g., when using the `i` helper).
* `iex(22)` highlights the setting we're currently interested in, the `:limit` field:

<blockquote>:limit - limits the number of items that are printed for tuples, bitstrings, and lists, does not apply to strings nor char lists, defaults to 50.<footer><cite><a href="http://elixir-lang.org/docs/v1.2/elixir/Inspect.Opts.html">Inspect.Opts doc</a></cite></footer></blockquote>

* `iex(23)` just shows that if we take 50 from the List of keys, we do indeed end up with all the keys printed in `iex(19)` (no ellipsis).
* `iex(24)` is setting the inspection limit to 70 (by supplying a [keyword list](http://elixir-lang.org/getting-started/maps-and-dicts.html#keyword-lists) argument). More specifically, it is setting the IEx configuration for inspection via the `:inspect` keyword list element, whose value takes yet another keyword list made up of the [Inspect.Opts](http://elixir-lang.org/docs/v1.2/elixir/Inspect.Opts.html) fields we've just seen:

<blockquote>A keyword list containing inspect options used by the shell when printing results of expression evaluation. Default to pretty formatting with a limit of 50 entries.
See [Inspect.Opts](http://elixir-lang.org/docs/v1.2/elixir/Inspect.Opts.html) for the full list of options.
<footer><cite><a href="http://elixir-lang.org/docs/stable/iex/IEx.html#configure/1">IEx.configure/1 :inspect option</a></cite></footer></blockquote>

* `iex(25)` shows the result of this configuration. We are now able to print out all 68 keys.

You might want to read [The .iex.exs file](http://elixir-lang.org/docs/stable/iex/IEx.html) section in the IEx docs if you're interested in setting IEx configuration on shell startup (or just setting up IEx with pre-bound variables etc…). Kudos to [Gary Rennie](https://groups.google.com/forum/?utm_medium=email&utm_source=footer#!topic/elixir-lang-talk/2wQOc5S0z1o) for helping me find this when I was first looking for it.

# Building an API with Streams

Back to our "intention" here. With all this background you should now be better equipped to digest most of the code in Drew's original post. However, the `Github.ResultStream` module below is worth breaking down as it features a couple of things we haven't yet discussed:

```elixir
defmodule Github.ResultStream do
  alias Github.Gateway

  def new(url) do
    Stream.resource(
      fn -> fetch_page(url) end,
      &process_page/1,
      fn _ -> nil end
    )
  end

  defp fetch_page(url) do
    response = Gateway.get!(url)
    items = Poison.decode!(response.body)
    links = parse_links(response.headers["Link"])

    {items, links["next"]}
  end

  def parse_links(nil) do
    %{}
  end

  def parse_links(links_string) do
    links = String.split(links_string, ", ")

    Enum.map(links, fn link ->
      [_,name] = Regex.run(~r{rel="([a-z]+)"}, link)
      [_,url] = Regex.run(~r{<([^>]+)>}, link)
      short_url = String.replace(url, Gateway.endpoint, "")

      {name, short_url}
    end) |> Enum.into(%{})
  end

  defp process_page({nil, nil}) do
    {:halt, nil}
  end

  defp process_page({nil, next_page_url}) do
    next_page_url
    |> fetch_page
    |> process_page
  end

  defp process_page({items, next_page_url}) do
    {items, {nil, next_page_url}}
  end
end
```

## [Stream.resource/3](http://elixir-lang.org/docs/v1.2/elixir/Stream.html#resource/3)

To make sense of this, it's probably best to just jump straight to the example given in the online docs:

```elixir
# Stream.resource(start_fun, next_fun, after_fun)
# @spec resource((() -> acc), (acc -> {element, acc} | {:halt, acc}), (acc -> term)) :: Enumerable.t
Stream.resource(fn -> File.open!("sample") end,
                fn file ->
                  case IO.read(file, :line) do
                    data when is_binary(data) -> {[data], file}
                    _ -> {:halt, file}
                  end
                end,
                fn file -> File.close(file) end)
```

So `Stream.resource/3` takes 3 functions, `start_fun`, `next_fun`, and `after_fun`.

The result of `start_fun` is fed as an argument to `next_fun` which is responsible for generating the stream's values. In this case, that result is a [process](http://elixir-lang.org/getting-started/processes.html) id (or PID):

```elixir
# we're using the file we wrote in iex(17) above
iex(26)> File.open!("./elixir_repo.json")
#PID<0.64.0>
```

<blockquote>Every time a file is opened, Elixir spawns a new process.<footer><cite><a href="http://elixir-lang.org/docs/v1.2/elixir/File.html">File module doc</a></cite></footer></blockquote>

Note that the result of [File.open!/2](http://elixir-lang.org/docs/v1.2/elixir/File.html#open!/2) is different from that of [File.open/2](http://elixir-lang.org/docs/v1.2/elixir/File.html#open/2) (also note that the second arg is optional in both cases):

```elixir
iex(27)> File.open("./elixir_repo.json")
{:ok, #PID<0.66.0>}
```

i.e. it's wrapped in a tuple. You can read up on this in the "Trailing bang" section in the [naming conventions](http://elixir-lang.org/docs/master/elixir/naming-conventions.html) doc. The [File module](http://elixir-lang.org/docs/v1.2/elixir/File.html)'s doc also mentions this in the "API" section.

This PID is called an `io_device` in the doc for the File module, and an `io_device` can be used as an argument to the [IO module](http://elixir-lang.org/docs/v1.2/elixir/IO.html) functions.

That is exactly what's happening in `next_fun` above, which is passing `file` (bound to a PID), to [IO.read/2](http://elixir-lang.org/docs/v1.2/elixir/IO.html#read/2) to read a line from the `io_device`:

```elixir
iex(28)> file = v(26)
#PID<0.64.0>
iex(29)> IO.read(file, :line)
"{\n"
iex(30)> IO.read(file, :line)
"  \"teams_url\": \"https://api.github.com/repos/elixir-lang/elixir/teams\",\n"
iex(31)> IO.read(file, :line)
"  \"branches_url\": \"https://api.github.com/repos/elixir-lang/elixir/branches{/branch}\",\n"
iex(32)> is_binary IO.read(file, :line)
true
```

With the `:line` option, `IO.read/2` will keep giving us binary data until we read the whole file, at which point it will return an `:eof` atom which will match our second clause in our `next_fun`'s `case` expression. So from this we can see that `next_fun` either returns `{[data], file}` or `{:halt, file}` - i.e. either the next line in the file as a string wrapped in a list or `:halt` to mark the end of the stream, in both cases accompanied by `file` our accumulator (the thing by which we're able to keep streaming values).

<blockquote>Successive values are generated by calling `next_fun` with the previous accumulator (the initial value being the result returned by `start_fun`) and it must return a tuple containing a **list of items** to be emitted and the next accumulator.

<footer>Why do we wrap the read line in a list?<cite><a href="http://elixir-lang.org/docs/v1.2/elixir/Stream.html#resource/3">Stream.resource/3 doc</a></cite></footer></blockquote>

Finally, the `after_fun` is called with the accumulator (`file`) in order to give us an opportunity to clean up after ourselves, in this case, closing the file.

With that, we now know the control flow abstracted by `Stream.resource/3`. If we take another look at it's usage in `Github.ResultStream`:

```elixir
  def new(url) do
    Stream.resource(
      fn -> fetch_page(url) end,
      &process_page/1,
      fn _ -> nil end
    )
  end
```

the other things to note before diving into the meat of its implementation (`process_page/1`), are the use of [Elixir partials](http://elixir-lang.org/crash-course.html#partials-in-elixir) to refer to `process_page/1` to act as `Stream.resource/3`'s `next_fun`, and the definition of a "do nothing" function for the `after_fun` (since we have nothing to clean up). Originally, the "do nothing" function was defined as: `fn _ -> end` in Drew's post but the compiler gives a warning for this syntax as of Elixir 1.2, so we need to evaluate to `nil` (which is what used to happen anyway when no expression was given). Kudos to [René Föhring](https://groups.google.com/forum/?utm_medium=email&utm_source=footer#!msg/elixir-lang-talk/CQcWAkbmg9o/jkDq2_h8DAAJ) for pointing this out.

<blockquote>[Kernel] Warn when right hand side of -> does not provide any expression<footer><cite><a href="https://github.com/elixir-lang/elixir/releases/tag/v1.2.0">v1.2.0 release notes</a></cite></footer></blockquote>

## The rest of Github.ResultStream


---

# TODO:

* mix help compile.app
  * in section about `application` startup (HTTPoison).

# Credits

* [Drew Olson](http://drewolson.org/) wrote the [post](http://blog.drewolson.org/elixir-streams/) on which this is based.
* René Föhring showed me how to write a ["do nothing" function](https://groups.google.com/forum/?utm_medium=email&utm_source=footer#!msg/elixir-lang-talk/CQcWAkbmg9o/jkDq2_h8DAAJ) (which is used in this post).
* Of course, many more people have helped create this post e.g. whoever is involved writing documentation, library authors, core committers etc… - but you all know who you are ;) - thanks!

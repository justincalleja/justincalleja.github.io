---
date: "2016-01-02"
title: "Elixir Streams reload"
tags: [ "elixir" ]
categories: [ "programming"]
tocEnabled: true

---

# Intro

This post is based on [Drew Olson](http://drewolson.org/)'s [Elixir Streams](http://blog.drewolson.org/elixir-streams/). Since I'm just getting started with [Elixir](http://elixir-lang.org/), I came across a few issues understanding the "Building an API with Streams" section in Drew's post. This post is my attempt at breaking it down.

I'm using Elixir 1.2.0 (and Erlang 18.1).

## Maybe worth mentioning

* I will not be using the exact Github endpoint (e.g. https://github.com/api/v3/orgs/elixir-lang/repos) used in Drew's post because:
  * I'm not familiar with the Github API
  * Couldn't get the given endpoint to work after generating an access token
  * Got the data I wanted anyway using the endpoint in this post (no need for access tokens)
  * It cuts down on code :)

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
Link: <https://api.github.com/organizations/9950313/repos?page=2>; rel="next", <https://api.github.com/organizations/9950313/repos?page=3>; rel="last"
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

In our first expression (`iex(1)>`), we are creating a stream from a list and a function, using `Stream.map/2`. The REPL shows us that we got back a stream from `Stream.map/2`. It shows us a human readable string [based on](https://github.com/elixir-lang/elixir/blob/v1.2/lib/elixir/lib/stream.ex#L1268-L1274) the [Inspect](http://elixir-lang.org/docs/v1.2/elixir/Inspect.html) protocol. As a side note:

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

Aren't we also able to just take 1 element using a list? The difference is that the data you `take/2` from `stream` doesn't actually exist until you take it, whereas that from `[4, 5, 6]` exists in memory before ever calling `take/2` on it.  Our `stream` could be getting this data from a database or a REST API.

For example, it could be giving `Enum.take/2` data it got from its first HTTP request to Github's REST API. If `take/2` doesn't want more than 30 repos, than `stream` only ever needs to make 1 HTTP request. If `take/2` wants more, `stream` would have to paginate as necessary but at least `take/2` doesn't have to wait until `stream` makes enough requests to exhaust the number of repos for a particular organization before it starts receiving data from `stream`.

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

In any case, starting iex and loading our app with `iex -S mix`, we can now start experimenting a bit:

```elixir
iex(1)> HTTPoison.get! "https://api.github.com/orgs/elixir-lang/repos"
# ...
```

should give you back a bunch of data with a status code of 200. From the example request in the project's [README.md](https://github.com/edgurgel/httpoison) (and from [this](https://github.com/edgurgel/httpoison/blob/v0.8.0/lib/httpoison.ex#L2)), we can see that the response we get back is a `HTTPoison.Response` [struct](http://elixir-lang.org/getting-started/structs.html) with an integer `status_code`, a binary `body`, and a list for `headers`:

```elixir
iex(2)> %HTTPoison.Response{body: body, headers: headers, status_code: status_code} = v(1)
# ...
```

Above, we're getting the evaluation of expression 1 in iex (i.e. the result of `iex(1)>`) and extracting its individual parts using [pattern matching](http://elixir-lang.org/getting-started/pattern-matching.html) (we're using the [v(n \\\\ -1)](http://elixir-lang.org/docs/master/iex/IEx.Helpers.html#v/1) iex helper function to do this). We now have the following bound variables which you can play around with in iex: `body`, `headers`, and `status_code`.


## Poison




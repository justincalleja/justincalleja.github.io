---
date: "2020-04-07"
title: "Generate your own types in fast-check"
tags: [ "fast-check", "property based testing" ]
categories: [ "programming" ]
tocEnabled: true

---

### TLDR

If your custom type is:

```ts
class ImaCustom {
    constructor(public s: Set<string>, public a: string[]) {}
}
```

… and if you're just getting started with this (like me) and thinking: "ok, now how do I randomly generate my `ImaCustom` instances?".

Try generating random sets and arrays which you can then use to create your `ImaCustom`s.

e.g.

```ts
import fc from "fast-check";

test("Some property you want to test", () => {
  fc.assert(
    fc.property(
      // generate [Set<string>, string[]] tuples with some size constraints
      fc.tuple(fc.set(fc.string(100), 25), fc.array(fc.string(100), 50)),
      ([s, a]) => {
        const i = new ImaCustom(s, a);
        // assert your property
      }
    )
  );
});
```

That's basically what I wanted to write about 😊

### A slow start to a fast-check

I guess you already know what property based testing is if you're here. Recently, I was testing something… which tbh, I didn't really know how I wanted to work. But in my mind, I could think of certain properties; certain things which had to hold on the datastructure in question when this operation happens. So - I figured I'd reach for that testing approach I know about; think is amazing; but almost never actually use 🤔

Anyway - it didn't take long to find [fast-check](https://github.com/dubzzz/fast-check#readme). I had used [jsverify](https://github.com/jsverify/jsverify) before, but I've forgotten the API and who cares anyway - I just want to code a few properties and get on with my app… maybe actually get it to a usable state 😅

So… I'm searching online:

> Ye, I know more or less what property based testing is. Great - first few examples show how to generate basic types. Cool, found the list of built-in… oh "arbitraries" they're called… hmm fancy that - and I thought I had an arbitrary name. Now if I could only get to the "how to generate your own flippin' types" in the documentation and give these stressed eyeballs a break.

Far as I can tell - that section doesn't exist in the docs. I did eventually have a 🤦‍♂️ moment and realised that any "custom" datastructure must be made up of more basic types.

### Show me da code!

This is basically the data I'm working with here ([Immutable.js](https://immutable-js.github.io/immutable-js/docs/#/) Set / OrderedSet):

```ts
export interface ContentProps {
  include?: OrderedSet<string>;
  exclude?: Set<string>;
}
```

… which is passed in to `Content`'s constructor to create an instance. But the constructor has some constraints:

```ts
    if (include.has("") || exclude.has("")) {
    // ... throw Error
    }

    const invalidValues = include.intersect(exclude);
    if (invalidValues.size > 0) {
    // ... throw Error
    }
```

So basically, no empty string in the sets and they must be mutually exclusive.

Finally, a `Content` can `sync` given a list of file paths `string[]`… and this is what I came up with for what I had in mind. **NOTE:** you do not need to understand or even read this code:

```ts
  public sync(filePaths: string[] = []): Content {
    const filePathsAsSet = Set(filePaths);
    const setOfFilePathsNotAlreadyExcluded = filePathsAsSet.subtract(
      this.exclude
    );
    const oldValidSectionsInRightOrder = this.include.intersect(
      setOfFilePathsNotAlreadyExcluded
    );
    const newValidSections = setOfFilePathsNotAlreadyExcluded.subtract(
      oldValidSectionsInRightOrder
    );

    const include = oldValidSectionsInRightOrder.concat(newValidSections);
    const exclude = filePathsAsSet.intersect(this.exclude);
    return new Content({
      dirName: this.dirName,
      include,
      exclude
    });
  }
```

One property I can think of is this:

> In `result = content.sync(filePaths: string[])` - any filePath in `filePaths` which is also in `content.exclude` should be in `result.exclude` and not in `result.include`

This is the property being demoed below, but if you want to get a feel of what `sync` is about, here are a couple more properties which come to mind:

* Any existing values in `content.exclude` which are not present in `filePaths` should not be in `result.exclude`
* Any existing values in `content.include` which are not present in `filePaths` should not be in `result.include`
* Any existing values in `content.include` which are in `filePaths` are kept in the same order in `result.include`

### Generating data

To express this property, I first want to express how the "ingredients" are generated, i.e. the arbitrary data:

```ts
const arbitrarySyncTestProps = fc.tuple(
  fc.set(fc.string(100), 25),
  fc.set(fc.string(100), 25),
  fc.array(fc.string(100), 50)
);
```

So - generate me a tuple of 2 sets of strings with a max size of 25 and whose strings are no more than 100 characters in length. Also, throw in an array of strings for good measure. Super simple - but now I want to get more specific… I should have no empty strings in either Set, nor in the array come to think of it - as those elements are meant to end up in a Set which doesn't want empty strings. Also, I want the two Sets to be mutually exclusive… and while we're at it - I think it won't do to just have random strings. Taking another look at the property:

> any filePath in `filePaths` which is also in `content.exclude` 

So, maybe I should ensure I get some strings which are in both `filePaths` and `exclude`:

```ts
const arbitrarySyncTestProps = fc
  .tuple(
    fc.set(fc.string(100), 25),
    fc.set(fc.string(100), 25),
    fc.array(fc.string(100), 50)
  )
  .map(([include, exclude, filePaths]) => {
    // make filePathsToAddToExclude so tests can be more meaningful
    let filePathsToAddToExclude = [];
    if (filePaths.length > 0) {
      const numberOfPathsToAddToExclude = Math.floor(
        Math.random() * filePaths.length
      );
      for (let i = 0; i <= numberOfPathsToAddToExclude; i++) {
        filePathsToAddToExclude.push(filePaths[i]);
      }
    }

    // transform the data so it meets Content's pre-conditions
    const includeOrderedSet = OrderedSet(
      include.filter((x) => x !== "" && !exclude.includes(x))
    );
    const excludeSet = Set(
      exclude.concat(filePathsToAddToExclude).filter((x) => x !== "")
    );
    const filePathsArray = filePaths.filter((x) => x !== "");

    return [includeOrderedSet, excludeSet, filePathsArray];
  });
```

### Expressing the property

Finally, the property can be expressed with a few simple assertions:

```ts
([include, exclude, filePaths]: [
  OrderedSet<string>,
  Set<string>,
  string[]
]) => {
  const content = new Content({
    include,
    exclude,
  });
  const result = content.sync(filePaths);
  const pathsInBothFilePathsAndExclude: Set<string> = content.exclude.intersect(
    Set(filePaths)
  );

  expect(pathsInBothFilePathsAndExclude.isSubset(content.exclude)).toBe(true);
  expect(result.include.intersect(pathsInBothFilePathsAndExclude).size).toBe(0);
};
```

#### Putting it all together

```ts
import fc from "fast-check";
import { Set, OrderedSet } from "immutable";
import { Content } from "./Content";

describe("Content", () => {
  describe("content.sync(filePaths: string[])", () => {
    test("Any filePath in filePaths which is also in content.exclude should be in result.exclude and not in result.include", () => {
      const arbitrarySyncTestProps = fc
        .tuple(
          fc.set(fc.string(100), 25),
          fc.set(fc.string(100), 25),
          fc.array(fc.string(100), 50)
        )
        .map(([include, exclude, filePaths]) => {
          // make filePathsToAddToExclude so tests can be more meaningful
          let filePathsToAddToExclude = [];
          if (filePaths.length > 0) {
            const numberOfPathsToAddToExclude = Math.floor(
              Math.random() * filePaths.length
            );
            for (let i = 0; i <= numberOfPathsToAddToExclude; i++) {
              filePathsToAddToExclude.push(filePaths[i]);
            }
          }

          // transform the data so it meets Content's pre-conditions
          const includeOrderedSet = OrderedSet(
            include.filter((x) => x !== "" && !exclude.includes(x))
          );
          const excludeSet = Set(
            exclude.concat(filePathsToAddToExclude).filter((x) => x !== "")
          );
          const filePathsArray = filePaths.filter((x) => x !== "");

          return [includeOrderedSet, excludeSet, filePathsArray];
        });

      fc.assert(
        fc.property(
          arbitrarySyncTestProps,
          ([include, exclude, filePaths]: [
            OrderedSet<string>,
            Set<string>,
            string[]
          ]) => {
            const content = new Content({
              include,
              exclude,
            });
            const result = content.sync(filePaths);
            const pathsInBothFilePathsAndExclude: Set<string> = content.exclude.intersect(
              Set(filePaths)
            );

            expect(
              pathsInBothFilePathsAndExclude.isSubset(content.exclude)
            ).toBe(true);
            expect(
              result.include.intersect(pathsInBothFilePathsAndExclude).size
            ).toBe(0);
          }
        )
      );
    });
  });
});
```

### In conclusion

It was fun to revisit property based testing. One issue I know will come up is the matter of performance. This is taking circa *5 seconds* to run so I know its going to be problem. Maybe I'll only run the property based tests when an env var is set, or configure `fast-check` to "be more fast!" … somehow (e.g. generate less tests). In any case, it's still useful and I have already found a couple of issues with my implementation.

Any feedback on this is more than welcome 👇

🍻

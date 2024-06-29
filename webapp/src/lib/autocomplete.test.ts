import {
  AutocompleterV2,
  Word,
  _add,
  _remove,
  addWordsToTrie,
  createNode,
  findWords,
  removeWordsFromTrie,
} from "../autocomplete";
import { Symptom } from "./domain/model";
import { symptomToWords } from "./domain/symptoms";
import { buildSymptom } from "./test/helpers";
import { describe, expect, test } from "vitest";

describe("TrieNode", () => {
  test("only matches words starting with prefix", () => {
    const trie = addWordsToTrie(createNode(), ["code", "coder", "cocoa", "banana"]);
    expect(findWords(trie, "co")).toEqual(new Set(["code", "coder", "cocoa"]));
  });

  describe(`find words by prefix`, () => {
    test(`initialize an empty TrieNode`, () => {
      const trie = createNode();
      expect(trie).toEqual({ children: new Map(), isWordEnd: false });
    });

    test(`when there are no words to match`, () => {
      const noWords: Word[] = [];
      const trie = addWordsToTrie(createNode(), noWords);
      expect(findWords(trie, "blah")).toEqual(new Set<Word>());
    });

    test(`when no word matches the provided prefix`, () => {
      const trie = addWordsToTrie(createNode(), ["bu", "bun", "bum", "be"]);
      expect(findWords(trie, "blah")).toEqual(new Set<Word>([]));
    });

    test(`when some words match the provided prefix`, () => {
      const trie = addWordsToTrie(createNode(), ["bu", "bun", "bum", "be"]);
      expect(findWords(trie, "bu")).toEqual(new Set<Word>(["bu", "bun", "bum" /* be */]));
    });
  });

  describe(`add word to trie`, () => {
    test(`by mutating the trie`, () => {
      const trie = addWordsToTrie(createNode(), ["bu", "bun", "bum", "be"]);
      expect(findWords(trie, "boom")).toEqual(new Set<Word>());

      _add(trie, "boomerang");
      expect(findWords(trie, "boom")).toEqual(new Set<Word>(["boomerang"]));
    });

    test(`without mutating the trie`, () => {
      const trie = addWordsToTrie(createNode(), ["bu", "bun", "bum", "be"]);
      expect(findWords(trie, "boom")).toEqual(new Set<Word>());

      const updated = addWordsToTrie(trie, ["boomerang"]);
      expect(findWords(updated, "boom")).toEqual(new Set<Word>(["boomerang"]));

      // Make sure the original trie was not mutates
      expect(findWords(trie, "boom")).toEqual(new Set<Word>());
    });
  });

  describe(`remove word from trie`, () => {
    describe(`by mutating the trie`, () => {
      test(`remove word that is not in the trie`, () => {
        const trie = addWordsToTrie(createNode(), ["foo", "bar"]);
        expect(findWords(trie, "foo")).toEqual(new Set<Word>(["foo"]));
        expect(findWords(trie, "bar")).toEqual(new Set<Word>(["bar"]));

        _remove(trie, "zoom");
        expect(findWords(trie, "foo")).toEqual(new Set<Word>(["foo"]));
        expect(findWords(trie, "bar")).toEqual(new Set<Word>(["bar"]));
      });

      test(`remove a standalone word`, () => {
        const trie = addWordsToTrie(createNode(), ["foo", "bar"]);
        expect(findWords(trie, "foo")).toEqual(new Set<Word>(["foo"]));
        expect(findWords(trie, "bar")).toEqual(new Set<Word>(["bar"]));

        _remove(trie, "foo");
        expect(findWords(trie, "foo")).toEqual(new Set<Word>([]));
        expect(findWords(trie, "bar")).toEqual(new Set<Word>(["bar"]));
      });

      test(`remove word ending in the middle of the trie`, () => {
        const trie = addWordsToTrie(createNode(), ["boom", "boomer", "be"]);
        expect(findWords(trie, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(trie, "be")).toEqual(new Set<Word>(["be"]));

        _remove(trie, "boom");
        expect(findWords(trie, "bo")).toEqual(new Set<Word>(["boomer"]));
        expect(findWords(trie, "be")).toEqual(new Set<Word>(["be"]));
      });

      test(`remove word ending in a leaf of the trie`, () => {
        const trie = addWordsToTrie(createNode(), ["boom", "boomer", "be"]);
        expect(findWords(trie, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(trie, "be")).toEqual(new Set<Word>(["be"]));

        _remove(trie, "boomer");
        expect(findWords(trie, "bo")).toEqual(new Set<Word>(["boom"]));
        expect(findWords(trie, "be")).toEqual(new Set<Word>(["be"]));
      });
    });

    describe(`without mutating the trie`, () => {
      test(`remove word that is not in the trie`, () => {
        const original = addWordsToTrie(createNode(), ["boom", "boomer", "be"]);
        expect(findWords(original, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(original, "be")).toEqual(new Set<Word>(["be"]));

        const updated = removeWordsFromTrie(original, ["foo"]);
        expect(findWords(updated, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(updated, "be")).toEqual(new Set<Word>(["be"]));

        // Make sure the original trie was not mutates
        expect(findWords(original, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(original, "be")).toEqual(new Set<Word>(["be"]));
      });

      test(`remove a standalone word`, () => {
        const original = addWordsToTrie(createNode(), ["foo", "bar"]);
        expect(findWords(original, "foo")).toEqual(new Set<Word>(["foo"]));
        expect(findWords(original, "bar")).toEqual(new Set<Word>(["bar"]));

        const updated = removeWordsFromTrie(original, ["foo"]);
        expect(findWords(updated, "foo")).toEqual(new Set<Word>());
        expect(findWords(updated, "bar")).toEqual(new Set<Word>(["bar"]));

        // Make sure the original trie was not mutates
        expect(findWords(original, "foo")).toEqual(new Set<Word>(["foo"]));
        expect(findWords(original, "bar")).toEqual(new Set<Word>(["bar"]));
      });

      test(`remove word ending in the middle of the trie`, () => {
        const original = addWordsToTrie(createNode(), ["boom", "boomer", "be"]);
        expect(findWords(original, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(original, "be")).toEqual(new Set<Word>(["be"]));

        const updated = removeWordsFromTrie(original, ["boom"]);
        expect(findWords(updated, "bo")).toEqual(new Set<Word>(["boomer"]));
        expect(findWords(updated, "be")).toEqual(new Set<Word>(["be"]));

        // Make sure the original trie was not mutates
        expect(findWords(original, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(original, "be")).toEqual(new Set<Word>(["be"]));
      });

      test(`remove word ending in a leaf of the trie`, () => {
        const original = addWordsToTrie(createNode(), ["boom", "boomer", "be"]);
        expect(findWords(original, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(original, "be")).toEqual(new Set<Word>(["be"]));

        const updated = removeWordsFromTrie(original, ["boomer"]);
        expect(findWords(updated, "bo")).toEqual(new Set<Word>(["boom"]));
        expect(findWords(updated, "be")).toEqual(new Set<Word>(["be"]));

        // Make sure the original trie was not mutates
        expect(findWords(original, "bo")).toEqual(new Set<Word>(["boom", "boomer"]));
        expect(findWords(original, "be")).toEqual(new Set<Word>(["be"]));
      });
    });
  });
});

describe(AutocompleterV2.name, () => {
  const coder = buildSymptom({ name: "Coder" });
  const code = buildSymptom({ name: "Code" });
  const cocoa = buildSymptom({ name: "Cocoa" });
  const banana = buildSymptom({ name: "Banana" });

  describe(`search for items`, () => {
    const completer = new AutocompleterV2<Symptom>({
      itemToWordMapper: symptomToWords,
    });
    completer.initialize({ items: [coder, code, cocoa, banana] });

    test("by prefix", () => {
      const matched = completer.search("co");
      expect(matched).toEqual(new Set([coder, code, cocoa]));
    });

    test("ignores case", () => {
      const uppercaseMatch = completer.search("CO");
      expect(uppercaseMatch).toEqual(new Set([coder, code, cocoa]));

      const lowercaseMatch = completer.search("co");
      expect(lowercaseMatch).toEqual(new Set([coder, code, cocoa]));
    });

    test("match the start of any word in the item", () => {
      const bigCocoa: Symptom = buildSymptom({ name: "Big cocoa" });
      const items: Symptom[] = [coder, bigCocoa, banana];

      const completer = new AutocompleterV2<Symptom>({
        itemToWordMapper: symptomToWords,
      });
      completer.initialize({ items });

      const matched = completer.search("co");
      expect(matched).toEqual(new Set([coder, bigCocoa]));
    });

    test("do not match multiple prefixes", () => {
      const matched = completer.search("cod ban");
      expect(matched).toEqual(new Set([]));
    });
  });

  test(`add item to ${AutocompleterV2.name}`, () => {
    const completer = new AutocompleterV2<Symptom>({
      itemToWordMapper: symptomToWords,
    });
    completer.initialize({ items: [cocoa, code] });
    expect(completer.search("c")).toEqual(new Set([cocoa, code]));
    expect(completer.search("b")).toEqual(new Set());

    completer.addItem(banana);

    expect(completer.search("c")).toEqual(new Set([cocoa, code]));
    expect(completer.search("b")).toEqual(new Set([banana]));
  });

  test(`remove item from ${AutocompleterV2.name}`, () => {
    const completer = new AutocompleterV2<Symptom>({
      itemToWordMapper: symptomToWords,
    });
    completer.initialize({ items: [cocoa, code, coder, banana] });
    expect(completer.search("c")).toEqual(new Set([cocoa, code, coder]));
    expect(completer.search("b")).toEqual(new Set([banana]));

    completer.removeItem(code);

    expect(completer.search("c")).toEqual(new Set([cocoa, coder]));
    expect(completer.search("b")).toEqual(new Set([banana]));
  });
});

describe(AutocompleterV2.name, () => {
  const symptomA = buildSymptom({ name: "foo bar baz" });
  const symptomB = buildSymptom({ name: "bar blah" });

  test(`spaces behave as AND operators`, () => {
    const completer = new AutocompleterV2<Symptom>({
      itemToWordMapper: symptomToWords,
    });

    completer.initialize({ items: [symptomA, symptomB] });

    expect(completer.search("foo ba")).toEqual(new Set([symptomA]));
    expect(completer.search("baz")).toEqual(new Set([symptomA]));
    expect(completer.search("bar")).toEqual(new Set([symptomA, symptomB]));
  });
});

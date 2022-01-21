import {
  Symptom,
  Metric,
  groupByDay,
  Intensity,
  ItemAutocompleter,
} from "./domain";

describe("Find items", () => {
  const defaultArgs = { shop: "Lidl", toBuy: true, otherNames: [] };

  const coder: Symptom = { id: 1, name: "Coder", ...defaultArgs };
  const code: Symptom = { id: 2, name: "Code", ...defaultArgs };
  const cocoa: Symptom = { id: 3, name: "Cocoa", ...defaultArgs };
  const banana: Symptom = { id: 4, name: "Banana", ...defaultArgs };

  const items: Symptom[] = [coder, code, cocoa, banana];

  const completer = new ItemAutocompleter(items);

  test("by prefix", () => {
    const matched = completer.search(["co"]);
    expect(matched).toEqual(new Set([coder, code, cocoa]));
  });

  test("ignores case", () => {
    const uppercaseMatch = completer.search(["CO"]);
    expect(uppercaseMatch).toEqual(new Set([coder, code, cocoa]));

    const lowercaseMatch = completer.search(["co"]);
    expect(lowercaseMatch).toEqual(new Set([coder, code, cocoa]));
  });

  test("match the start of any word in the item", () => {
    const bigCocoa: Symptom = { id: 5, name: "Big cocoa", ...defaultArgs };
    const items: Symptom[] = [coder, bigCocoa, banana];

    const completer = new ItemAutocompleter(items);

    const matched = completer.search(["co"]);
    expect(matched).toEqual(new Set([coder, bigCocoa]));
  });

  test("match multiple prefixes", () => {
    // let the UI split by space and pass each chunk to the autocompleter
    const prefixes: string[] = ["cod", "ban"];

    const matched = completer.search(prefixes);
    expect(matched).toEqual(new Set([coder, code, banana]));
  });
});

test("group completed activities by day", () => {
  const a: Metric = {
    id: 1658253269730,
    symptomId: 1,
    intensity: Intensity.medium,
    date: new Date("2022-07-18T17:54:29.730Z"),
    notes: "",
  };

  const b: Metric = {
    id: 1658253273787,
    symptomId: 1,
    intensity: Intensity.medium,
    date: new Date("2022-07-19T17:54:33.787Z"),
    notes: "",
  };

  const history = [a, b];

  const result = groupByDay(history);
  expect(result).toEqual([
    ["2022-07-18", [a]],
    ["2022-07-19", [b]],
  ]);
});

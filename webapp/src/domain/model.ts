import { buildTrie, findWords, TrieNode, Word } from "../autocomplete";

export type ISODatetimeString = string; // "2022-07-19T07:11:00+01:00"
export type ISODateString = string; // "2022-07-19"
export type Hash = string;
export type SymptomId = string;
export type MetricId = string;
export type SymptomName = string;
export interface Symptom {
  id: SymptomId;
  name: SymptomName;
  otherNames: SymptomName[];
  lastModified: Date;
}
export enum Intensity {
  low = "low",
  medium = "medium",
  high = "high",
}
export type Notes = string;
export interface Metric {
  id: MetricId;
  symptomId: SymptomId;
  intensity: Intensity;
  date: Date;
  notes: Notes;
  lastModified: Date;
}

export type FilterQuery = string;

export function filterSymptoms(symptoms: Symptom[], query: FilterQuery): Symptom[] {
  if (query === "") return symptoms;
  const completer = new ItemAutocompleter(symptoms);

  const prefixes = query.split(" ").filter((prefix) => !!prefix);
  if (!prefixes) return symptoms;

  const unsortedResults = completer.search(prefixes);

  return symptoms.filter((symptom) => unsortedResults.has(symptom));
}

interface WordsToItemMap {
  [w: Word]: Symptom[];
}
export class ItemAutocompleter {
  private trie: TrieNode;
  private wordToItems: WordsToItemMap;
  constructor(private readonly items: Symptom[]) {
    const [words, map] = this.symptomsToWords(items);
    this.trie = buildTrie(words);
    this.wordToItems = map;
  }

  public search(prefixes: string[]): Set<Symptom> {
    const results: Set<Symptom> = new Set();

    prefixes
      .map((prefix) => this.searchSinglePrefix(prefix))
      .map((items) => [...items])
      .flat()
      .forEach((item) => results.add(item));

    return results;
  }

  private searchSinglePrefix(prefix: string): Set<Symptom> {
    const words = findWords(this.trie, prefix.toLowerCase());
    const items = this.getSymptomFromWords(words);
    return items;
  }

  private symptomsToWords(symptoms: Symptom[]): [Word[], WordsToItemMap] {
    const words: Set<Word> = new Set();
    const map: WordsToItemMap = {};

    for (const symptom of symptoms) {
      const symptomWords = this.getWordsFromSymptom(symptom);

      for (const word of symptomWords) {
        words.add(word);

        if (!map[word]) {
          map[word] = [symptom];
        } else {
          map[word].push(symptom);
        }
      }
    }

    const wordList: Word[] = [...words];

    return [wordList, map];
  }

  private getWordsFromSymptom(symptom: Symptom): Set<Word> {
    const symptomWords = [symptom.name, ...(symptom.otherNames || [])]
      .filter((name) => name)
      .map((name) => name.toLowerCase())
      .map((name) => name.split(" "))
      .flat();

    const words = new Set(symptomWords);
    return words;
  }

  private getSymptomFromWords(words: Set<string>): Set<Symptom> {
    const symptoms: Set<Symptom> = new Set();

    for (const word of words) {
      const wordItems = this.wordToItems[word];
      wordItems.forEach((word) => symptoms.add(word));
    }

    return symptoms;
  }
}

export function findSymptomById(symptoms: Symptom[], id: SymptomId): Symptom | undefined {
  const matches = symptoms.filter((symptom) => symptom.id === id);
  if (matches.length === 0) {
    return undefined;
  }

  // Assumption: symptom IDs are unique
  const symptom = matches[0];

  return symptom;
}

export function findSymptomIdByName(
  symptoms: Symptom[],
  name: SymptomName
): SymptomId | undefined {
  const matches = symptoms.filter((symptom) => symptom.name === name);
  if (matches.length === 0) {
    return undefined;
  }

  // Assumption: symptom names are unique
  const symptom = matches[0];

  return symptom.id;
}

export function indexSymptoms(symptoms: Symptom[]): Map<SymptomId, Symptom> {
  const map = new Map<SymptomId, Symptom>();
  symptoms.forEach((symptom) => {
    map.set(symptom.id, symptom);
  });
  return map;
}

function getDay(date: Date): ISODateString {
  return date.toISOString().slice(0, 10);
}
type DatedMetrics = [ISODateString, Metric[]];

export function groupByDay(history: Metric[]): DatedMetrics[] {
  let dayCursor: ISODateString = getDay(history[0].date);

  let groupedMetrics: Metric[] = [];
  const result: DatedMetrics[] = [];

  history.forEach((metric, i) => {
    const day = getDay(metric.date);
    if (day === dayCursor) {
      groupedMetrics.push(metric);
    } else {
      result.push([dayCursor, [...groupedMetrics]]);
      groupedMetrics = [metric];
      dayCursor = day;
    }
  });

  if (groupedMetrics.length > 0) {
    result.push([dayCursor, [...groupedMetrics]]);
  }

  return result;
}

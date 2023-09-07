import { TrieNode, Word, buildTrie, findWords } from "../../autocomplete";
import { FilterQuery, Symptom } from "../domain/model";

export function filterSymptoms(symptoms: Symptom[], query: FilterQuery): Symptom[] {
  if (query === "") return symptoms;
  const completer = new SymptomAutocompleter(symptoms);

  const prefixes = query.split(" ").filter((prefix) => !!prefix);
  if (!prefixes) return symptoms;

  const unsortedResults = completer.search(prefixes);

  return symptoms.filter((symptom) => unsortedResults.has(symptom));
}

interface WordsToItemMap {
  [w: Word]: Symptom[];
}

class SymptomAutocompleter {
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

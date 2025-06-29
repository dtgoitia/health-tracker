import { AutocompleterV2, Word } from "../../autocomplete";
import { now } from "../datetimeUtils";
import { unreachable } from "../devex";
import { generateId } from "../hash";
import { SortAction } from "../sort";
import { ErrorReason, Hash, Symptom, SymptomId, SymptomName } from "./model";
import { Observable, Subject } from "rxjs";
import { Err, Ok, Result } from "safe-types";

export const SYMPTOM_PREFIX = "sym";

interface InitializeArgs {
  symptoms: Symptom[];
}

interface AddSymptomArgs {
  name: SymptomName;
  otherNames: SymptomName[];
}

interface UpdateSymptomArgs {
  symptom: Symptom;
}

interface DeleteSymptomArgs {
  id: SymptomId;
}

type Error =
  | { kind: "InitializationFailed" }
  | { kind: "FailedToUpdateSymptom"; reason: ErrorReason };

export class SymptomManager {
  public changes$: Observable<SymptomChange>;

  private changesSubject: Subject<SymptomChange>;
  private symptoms: Map<SymptomId, Symptom>;
  private autocompleter: AutocompleterV2<Symptom>;
  private initialized: boolean;

  constructor() {
    this.autocompleter = new AutocompleterV2<Symptom>({
      itemToWordMapper: symptomToWords,
    });

    this.changesSubject = new Subject<SymptomChange>();
    this.changes$ = this.changesSubject.asObservable();

    this.symptoms = new Map<SymptomId, Symptom>();
    this.initialized = false;
  }

  public initialize({ symptoms }: InitializeArgs): void {
    if (this.initialized) {
      throw unreachable(`${SymptomManager.name} must only be initialized once`);
    }

    for (const symptom of symptoms) {
      this.symptoms.set(symptom.id, symptom);
    }

    this.autocompleter.initialize({ items: symptoms });

    this.initialized = true;
    this.changesSubject.next({ kind: "SymptomManagerInitialized" });
  }

  public add({ name, otherNames }: AddSymptomArgs): void {
    const id = this.generateSymptomId();
    const symptom: Symptom = {
      id,
      name,
      otherNames,
      lastModified: now(),
    };
    this.symptoms.set(id, symptom);
    this.autocompleter.addItem(symptom);
    this.changesSubject.next({ kind: "SymptomAdded", id });
  }

  public update({ symptom: updated }: UpdateSymptomArgs): Result<null, Error> {
    const { id } = updated;
    const previous = this.symptoms.get(id);
    if (previous === undefined) {
      return Err({
        kind: "FailedToUpdateSymptom",
        reason: `SymptomManager.update::No symptom found with ID ${id}, nothing will be updated`,
      });
    }

    this.symptoms.set(id, updated);

    this.autocompleter.removeItem(previous);
    this.autocompleter.addItem(updated);

    this.changesSubject.next({ kind: "SymptomUpdated", id });
    return Ok(null);
  }

  public delete({ id }: DeleteSymptomArgs): void {
    const previous = this.symptoms.get(id);
    if (previous === undefined) {
      console.debug(
        `SymptomManager.delete::No symptom found with ID ${id}, nothing will be deleted`
      );
      return;
    }

    this.autocompleter.removeItem(previous);
    this.symptoms.delete(id);
    this.changesSubject.next({ kind: "SymptomDeleted", id });
  }

  public get(id: SymptomId): Symptom | undefined {
    return this.symptoms.get(id);
  }

  public getAll(): Symptom[] {
    return [...this.symptoms.values()].sort(sortSymptomsAlphabetically);
  }

  /**
   * Context:
   *   When a symptom is added, the domain emits domain-events so that, for
   *   example, other parts of the system can pick up the new symptom and share
   *   it with the server.
   *
   * Problem:
   *   If the logic described above was used to add externally-created symptoms
   *   (aka, the ones created in another device) to the domain, the current
   *   system would think these symptoms were created in the current system and
   *   therefore they need to be shared with the server. But that is not the
   *   case, as the server was who shared these symptoms in the first place, so
   *   the current system should ideally not push these symptoms back to the
   *   server again.
   *
   * Solution:
   *   The domain emits a different domain-event when adding externally-created
   *   symptoms. This way, the current system can react differently and prevent
   *   pushing these symptoms back to the server again.
   */
  public addPulledData({ symptoms }: { symptoms: Symptom[] }): void {
    for (const symptom of symptoms) {
      this.symptoms.set(symptom.id, symptom);
    }
    this.changesSubject.next({ kind: "SymptomsAddedFromExternalSource" });
  }

  /**
   * Find symptoms that contain words starting with the provided query
   */
  public searchByPrefix(query: string): Symptom[] {
    const prefixes = query.split(" ").filter((prefix) => !!prefix);

    if (prefixes.length === 0) return this.getAll();

    const unsortedResults = this.autocompleter.search(prefixes.join(" "));

    return [...unsortedResults].sort(sortSymptomsAlphabetically);
  }

  private generateSymptomId() {
    let id: Hash = generateId({ prefix: SYMPTOM_PREFIX });

    // Make sure that no IDs are duplicated - rare, but very painful
    while (this.symptoms.has(id)) {
      id = generateId({ prefix: SYMPTOM_PREFIX });
    }

    return id;
  }
}

function sortSymptomsAlphabetically(a: Symptom, b: Symptom): SortAction {
  const name_a = a.name.toLowerCase();
  const name_b = b.name.toLowerCase();
  switch (true) {
    case name_a === name_b:
      return SortAction.PRESERVE_ORDER;
    case name_a < name_b:
      return SortAction.FIRST_A_THEN_B;
    case name_a > name_b:
      return SortAction.FIRST_B_THEN_A;
    default:
      throw unreachable();
  }
}

export type SymptomChange =
  | { kind: "SymptomManagerInitialized" }
  | { kind: "SymptomAdded"; id: SymptomId }
  | { kind: "SymptomUpdated"; id: SymptomId }
  | { kind: "SymptomDeleted"; id: SymptomId }
  | { kind: "SymptomsAddedFromExternalSource" };

export function setSymptomName(symptom: Symptom, name: SymptomName): Symptom {
  return { ...symptom, name, lastModified: new Date() };
}

export function setSymptomOtherNames(
  symptom: Symptom,
  otherNames: SymptomName[]
): Symptom {
  return { ...symptom, otherNames, lastModified: new Date() };
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

export function symptomToWords(symptom: Symptom): Set<Word> {
  const symptomWords = [symptom.name, ...(symptom.otherNames || [])]
    .filter((name) => name)
    .map((name) => name.toLowerCase())
    .map((name) => name.split(" "))
    .flat();

  const words = new Set(symptomWords);
  return words;
}

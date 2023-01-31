import { now } from "../datetimeUtils";
import { unreachable } from "./devex";
import { generateId } from "./hash";
import { Hash, Intensity, Symptom, SymptomId, SymptomName } from "./model";
import { SortAction } from "./sort";
import { Err, Ok, Result } from "./success";
import { Observable, Subject } from "rxjs";

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

interface DeleteteSymptomArgs {
  id: SymptomId;
}

export class SymptomManager {
  public changes$: Observable<SymptomChange>;

  private changesSubject: Subject<SymptomChange>;
  private symptoms: Map<SymptomId, Symptom>;

  constructor() {
    this.changesSubject = new Subject<SymptomChange>();
    this.changes$ = this.changesSubject.asObservable();

    this.symptoms = new Map<SymptomId, Symptom>();
  }

  public initialize({ symptoms }: InitializeArgs): void {
    for (const symptom of symptoms) {
      this.symptoms.set(symptom.id, symptom);
    }
  }

  public migrate(): void {
    for (const original of this.symptoms.values()) {
      if (needsMigration(original)) {
        const migrated = this.migrateSymptom(original);
        this.symptoms.set(migrated.id, migrated);

        // Update metrics that depend on this symptom
        this.changesSubject.next(new SymptomMigrated(original.id, migrated.id));

        this.delete({ id: original.id });
      }
    }
  }

  private migrateSymptom(symptom: Symptom): Symptom {
    const id = this.generateSymptomId();
    const migrated = { ...symptom, id };
    console.log(`Migrating sympotm from\n`, symptom, `\nto\n`, migrated);
    return migrated;
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
    this.changesSubject.next(new SymptomAdded(id));
  }

  public update({ symptom }: UpdateSymptomArgs): Result {
    const { id } = symptom;
    if (this.symptoms.has(id) === false) {
      return Err(
        `SymptomManager.update::No symptom found with ID ${id}, nothing will be updated`
      );
    }

    this.symptoms.set(id, symptom);

    this.changesSubject.next(new SymptomUpdated(id));
    return Ok(undefined);
  }

  public delete({ id }: DeleteteSymptomArgs): void {
    if (this.symptoms.has(id) === false) {
      console.debug(
        `SymptomManager.delete::No symptom found with ID ${id}, nothing will be deleted`
      );
      return;
    }

    this.symptoms.delete(id);
    this.changesSubject.next(new SymptomDeleted(id));
  }

  public get(id: SymptomId): Symptom | undefined {
    return this.symptoms.get(id);
  }

  public getAll(): Symptom[] {
    return [...this.symptoms.values()].sort(sortSymptomsAlphabetically);
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

export class SymptomAdded {
  constructor(public readonly id: SymptomId) {}
}

export class SymptomUpdated {
  constructor(public readonly id: SymptomId) {}
}

export class SymptomDeleted {
  constructor(public readonly id: SymptomId) {}
}

export class SymptomMigrated {
  constructor(public readonly oldId: SymptomId, public readonly newId: SymptomId) {}
}

export type SymptomChange =
  | SymptomAdded
  | SymptomUpdated
  | SymptomDeleted
  | SymptomMigrated;

export function setSymptomName(symptom: Symptom, name: SymptomName): Symptom {
  return { ...symptom, name, lastModified: now() };
}

export function setSymptomOtherNames(
  symptom: Symptom,
  otherNames: SymptomName[]
): Symptom {
  return { ...symptom, otherNames, lastModified: now() };
}

export function getIntensityLevelShorthand(intensity: Intensity): string {
  switch (intensity) {
    case Intensity.low:
      return "L";
    case Intensity.medium:
      return "M";
    case Intensity.high:
      return "H";
    default:
      throw unreachable(`unhandled Intensity variant: ${intensity}`);
  }
}

function needsMigration(symptom: Symptom): boolean {
  return typeof symptom.id === "number";
}

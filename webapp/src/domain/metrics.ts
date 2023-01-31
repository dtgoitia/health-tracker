import { now } from "../datetimeUtils";
import { unreachable } from "./devex";
import { generateId } from "./hash";
import { Hash, Intensity, Metric, MetricId, Notes, SymptomId } from "./model";
import { SortAction } from "./sort";
import { Err, Ok, Result } from "./success";
import {
  SymptomAdded,
  SymptomChange,
  SymptomDeleted,
  SymptomManager,
  SymptomMigrated,
  SymptomUpdated,
} from "./symptoms";
import { Observable, Subject } from "rxjs";

export const METRIC_PREFIX = "met";

interface InitializeArgs {
  metrics: Metric[];
}

type AddMetricArgs = Omit<Metric, "id" | "lastModified">;

interface UpdateMetricArgs {
  metric: Metric;
}

interface DeleteteMetricArgs {
  id: MetricId;
}

interface ConstructorArgs {
  symptomManager: SymptomManager;
}

export class MetricManager {
  public changes$: Observable<MetricChange>;

  private changesSubject: Subject<MetricChange>;
  private metrics: Map<MetricId, Metric>;
  private symptomManager: SymptomManager;

  constructor({ symptomManager }: ConstructorArgs) {
    this.changesSubject = new Subject<MetricChange>();
    this.changes$ = this.changesSubject.asObservable();

    this.symptomManager = symptomManager;

    this.metrics = new Map<MetricId, Metric>();

    this.symptomManager.changes$.subscribe((change) => {
      this.handleSymptomChange(change);
    });
  }

  public initialize({ metrics }: InitializeArgs): void {
    for (const metric of metrics) {
      this.metrics.set(metric.id, metric);
    }
  }

  public migrate(): void {
    for (const original of this.metrics.values()) {
      if (needsMigration(original)) {
        const migrated = this.migrateMetric(original);
        this.metrics.delete(original.id);
        this.metrics.set(migrated.id, migrated);
        this.changesSubject.next(new MetricUpdated("doesn't matter"));
      }
    }
  }

  private migrateMetric(metric: Metric): Metric {
    const id = this.generateMetricId();
    const migrated = { ...metric, id };
    console.log(`Migrating metric from\n`, metric, `\nto\n`, migrated);
    return migrated;
  }

  public add({ symptomId, date, intensity, notes }: AddMetricArgs): void {
    const id = this.generateMetricId();
    const metric: Metric = {
      id,
      symptomId,
      intensity,
      notes,
      date,
      lastModified: now(),
    };
    this.metrics.set(id, metric);
    this.changesSubject.next(new MetricAdded(id));
  }

  public update({ metric }: UpdateMetricArgs): Result {
    const { id } = metric;
    if (this.metrics.has(id) === false) {
      return Err(
        `MetricManager.update::No metric found with ID ${id}, nothing will be updated`
      );
    }

    this.metrics.set(id, metric);

    this.changesSubject.next(new MetricUpdated(id));
    return Ok(undefined);
  }

  public delete({ id }: DeleteteMetricArgs): void {
    if (this.metrics.has(id) === false) {
      console.debug(
        `${MetricManager.name}.delete::No metric found with ID ${id}, nothing` +
          ` will be deleted`
      );
      return;
    }

    this.metrics.delete(id);
    this.changesSubject.next(new MetricDeleted(id));
  }

  public get(id: MetricId): Metric | undefined {
    return this.metrics.get(id);
  }

  public getAll(): Metric[] {
    return [...this.metrics.values()].sort(sortMetricsByDate);
  }

  public isSymptomUsedInHistory({ symptomId }: { symptomId: SymptomId }): boolean {
    for (const metric of this.metrics.values()) {
      if (metric.symptomId === symptomId) {
        return true;
      }
    }
    return false;
  }

  public duplicate({ ids }: { ids: Set<MetricId> }): void {
    for (const id of ids.values()) {
      const original = this.metrics.get(id);
      if (original === undefined) {
        continue;
      }

      this.add({ ...original, date: now() });
    }
  }

  private generateMetricId() {
    let id: Hash = generateId({ prefix: METRIC_PREFIX });

    // Make sure that no IDs are duplicated - rare, but very painful
    while (this.metrics.has(id)) {
      id = generateId({ prefix: METRIC_PREFIX });
    }

    return id;
  }

  private handleSymptomChange(change: SymptomChange): void {
    // console.debug(`CompletedActivityManager.handleActivityChange:`, change);
    switch (true) {
      case change instanceof SymptomAdded:
        return;
      case change instanceof SymptomUpdated:
        return;
      case change instanceof SymptomDeleted:
        return;
      case change instanceof SymptomMigrated:
        this.handleSymptomMigration(change as SymptomMigrated);
        return;
      default:
        throw unreachable(`unsupported change type: ${change}`);
    }
  }

  private handleSymptomMigration({ oldId, newId }: SymptomMigrated): void {
    console.log(
      `${MetricManager.name}.handleSymptomMigration::migrating metrics that point for Symptom ${oldId} to ${newId}`
    );
    for (const metric of this.metrics.values()) {
      if (metric.symptomId === oldId) {
        const migrated: Metric = { ...metric, symptomId: newId };
        this.metrics.set(metric.id, migrated);
        this.changesSubject.next(new MetricUpdated(metric.id));
      }
    }
  }
}

function sortMetricsByDate(a: Metric, b: Metric): SortAction {
  const date_a = a.date.getTime();
  const date_b = b.date.getTime();
  // Sort from newest to oldest
  switch (true) {
    case date_a === date_b:
      return SortAction.PRESERVE_ORDER;
    case date_a > date_b:
      return SortAction.FIRST_A_THEN_B;
    case date_a < date_b:
      return SortAction.FIRST_B_THEN_A;
    default:
      throw unreachable();
  }
}

export class MetricAdded {
  constructor(public readonly id: MetricId) {}
}

export class MetricUpdated {
  constructor(public readonly id: MetricId) {}
}

export class MetricDeleted {
  constructor(public readonly id: MetricId) {}
}

export type MetricChange = MetricAdded | MetricUpdated | MetricDeleted;

export function setMetricIntensity(metric: Metric, intensity: Intensity): Metric {
  return { ...metric, intensity, lastModified: now() };
}

export function setMetricNotes(metric: Metric, notes: Notes): Metric {
  return { ...metric, notes, lastModified: now() };
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

function needsMigration(metric: Metric): boolean {
  return typeof metric.id === "number";
}

import {
  DayAmount,
  Milliseconds,
  datetimeToMs,
  getDay,
  getLastNDates,
  now,
} from "../../datetimeUtils";
import { unreachable } from "../devex";
import { generateId } from "../hash";
import { SortAction } from "../sort";
import {
  ErrorReason,
  Hash,
  Intensity,
  Metric,
  MetricId,
  Notes,
  SymptomId,
} from "./model";
import { Observable, Subject } from "rxjs";
import { Err, Ok, Result } from "safe-types";

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

type Error =
  | { kind: "InitializationFailed" }
  | { kind: "FailedToUpdateMetric"; reason: ErrorReason };

export class MetricManager {
  public changes$: Observable<MetricChange>;

  private changesSubject: Subject<MetricChange>;
  private metrics: Map<MetricId, Metric>;
  private metricsByDate: Map<Milliseconds, Set<MetricId>>;
  private initialized: boolean;

  constructor() {
    this.changesSubject = new Subject<MetricChange>();
    this.changes$ = this.changesSubject.asObservable();

    this.metrics = new Map<MetricId, Metric>();
    this.metricsByDate = new Map<Milliseconds, Set<MetricId>>();

    this.initialized = false;
  }

  public initialize({ metrics }: InitializeArgs): void {
    if (this.initialized) {
      throw unreachable(`${MetricManager.name} must only be initialized once`);
    }
    for (const metric of metrics) {
      const { id } = metric;
      this.metrics.set(id, metric);

      // Potential optimization: skip any item that is older than yesterday
      this.addMetricToDateIndex(metric);
    }

    this.initialized = true;
    this.changesSubject.next({ kind: "MetricManagerInitialized" });
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
    this.changesSubject.next({ kind: "MetricAdded", id });
  }

  public update({ metric }: UpdateMetricArgs): Result<null, Error> {
    const { id } = metric;
    if (this.metrics.has(id) === false) {
      return Err({
        kind: "FailedToUpdateMetric",
        reason: `MetricManager.update::No metric found with ID ${id}, nothing will be updated`,
      });
    }

    // Update metrics-by-date index
    const previous = this.metrics.get(id);
    if (previous) {
      this.removeMetricFromDateIndex(previous);
    }

    this.metrics.set(id, metric);
    this.addMetricToDateIndex(metric);

    this.changesSubject.next({ kind: "MetricUpdated", id });
    return Ok(null);
  }

  private removeMetricFromDateIndex(metric: Metric): void {
    const day = getMetricDate(metric);
    const metricsInSameDay = this.metricsByDate.get(day) as Set<MetricId>;
    metricsInSameDay.delete(metric.id);
    this.metricsByDate.set(day, metricsInSameDay);
  }

  private addMetricToDateIndex(metric: Metric): void {
    const day = getMetricDate(metric);
    const metricsInSameDay = this.metricsByDate.get(day) || new Set<MetricId>();
    metricsInSameDay.add(metric.id);
    this.metricsByDate.set(day, metricsInSameDay);
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
    this.changesSubject.next({ kind: "MetricDeleted", id });
  }

  public get(id: MetricId): Metric | undefined {
    return this.metrics.get(id);
  }

  public getAll(): Metric[] {
    return [...this.metrics.values()].sort(sortMetricsByDate);
  }

  /**
   * Context:
   *   When a metric is added, the domain emits domain-events so that, for
   *   example, other parts of the system can pick up the new metric and share
   *   it with the server.
   *
   * Problem:
   *   If the logic described above was used to add externally-created metrics
   *   (aka, the ones created in another device) to the domain, the current
   *   system would think these metrics were created in the current system and
   *   therefore they need to be shared with the server. But that is not the
   *   case, as the server was who shared these metrics in the first place, so
   *   the current system should ideally not push these metrics back to the
   *   server again.
   *
   * Solution:
   *   The domain emits a different domain-event when adding externally-created
   *   metrics. This way, the current system can react differently and prevent
   *   pushing these metrics back to the server again.
   */
  public addPulledData({ metrics }: { metrics: Metric[] }): void {
    for (const metric of metrics) {
      this.metrics.set(metric.id, metric);
    }
    this.changesSubject.next({ kind: "MetricsAddedFromExternalSource" });
  }

  public getMetricsOfLastNDays({ n }: { n: DayAmount }): Metric[] {
    const desiredDates = getLastNDates({ n });
    const ids = new Set<MetricId>();
    for (const date of desiredDates) {
      const dateInMs = datetimeToMs(date);
      const idsInDate = this.metricsByDate.get(dateInMs) || new Set<MetricId>();
      for (const id of idsInDate) {
        ids.add(id);
      }
    }

    const metrics: Metric[] = [];
    for (const id of ids) {
      const metric = this.metrics.get(id);
      if (metric === undefined) continue;
      metrics.push(metric);
    }

    return metrics.sort(sortMetricsByDate);
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

export type MetricChange =
  | { kind: "MetricManagerInitialized" }
  | { kind: "MetricAdded"; id: MetricId }
  | { kind: "MetricUpdated"; id: MetricId }
  | { kind: "MetricDeleted"; id: MetricId }
  | { kind: "MetricsAddedFromExternalSource" };

export function setMetricDate(metric: Metric, date: Date): Metric {
  return { ...metric, date, lastModified: new Date() };
}

export function setMetricIntensity(metric: Metric, intensity: Intensity): Metric {
  return { ...metric, intensity, lastModified: new Date() };
}

export function setMetricNotes(metric: Metric, notes: Notes): Metric {
  return { ...metric, notes, lastModified: new Date() };
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

/**
 * The return value of this function is used to index metrics by date
 */
function getMetricDate(metric: Metric): Milliseconds {
  return datetimeToMs(getDay(metric.date));
}

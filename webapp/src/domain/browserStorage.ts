import { now } from "../datetimeUtils";
import { Storage } from "../localStorage";
import { unreachable } from "./devex";
import { MetricManager } from "./metrics";
import { Metric, Symptom } from "./model";
import { SymptomManager } from "./symptoms";

interface BrowserStorageArgs {
  symptomManager: SymptomManager;
  metricManager: MetricManager;
  storage: Storage;
}

export class BrowserStorage {
  private symptomManager: SymptomManager;
  private metricManager: MetricManager;
  private storage: Storage;

  constructor({ symptomManager, metricManager, storage }: BrowserStorageArgs) {
    this.symptomManager = symptomManager;
    this.metricManager = metricManager;
    this.storage = storage;

    this.symptomManager.changes$.subscribe((_) => {
      this.handleSymptomChanges();
    });

    this.metricManager.changes$.subscribe((_) => {
      this.handleMetricChanges();
    });
  }

  public getSymptoms(): Symptom[] {
    if (this.storage.symptoms.exists() === false) {
      return [];
    }

    const rawSymptoms = this.storage.symptoms.read();
    if (!rawSymptoms) {
      return [];
    }

    const symptoms = rawSymptoms.map(deserializeSymptom);
    return symptoms;
  }

  public getMetrics(): Metric[] {
    if (this.storage.history.exists() === false) {
      return [];
    }

    const rawMetrics = this.storage.history.read();
    if (!rawMetrics) {
      return [];
    }

    const metrics = rawMetrics.map(deserializeMetric);
    return metrics;
  }

  private handleSymptomChanges(): void {
    this.storage.symptoms.set(this.symptomManager.getAll());
  }

  private handleMetricChanges(): void {
    this.storage.history.set(this.metricManager.getAll());
  }
}

function deserializeSymptom(raw: object): Symptom {
  if (raw === null || raw === undefined) {
    throw unreachable();
  }

  // Remove once all items have been migrated
  if ("lastModified" in raw === false) {
    return { ...raw, lastModified: now() } as Symptom;
  }

  return raw as Symptom;
}

function deserializeMetric(raw: any): Metric {
  if (raw === null || raw === undefined) {
    throw unreachable();
  }

  const metric: Metric = {
    ...raw,
    date: deserializeDate(raw.date),
    lastModified:
      // Remove once all items have been migrated
      "lastModified" in raw === false ? now() : deserializeDate(raw.lastModified),
  };

  return metric;
}

function deserializeDate(raw: string): Date {
  return new Date(raw);
}

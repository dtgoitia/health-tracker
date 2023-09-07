import { LocalStorage } from "../../localStorage";
import { unreachable } from "../devex";
import { MetricManager } from "../domain/metrics";
import { Metric, Settings, Symptom } from "../domain/model";
import { SettingsManager } from "../domain/settings";
import { SymptomManager } from "../domain/symptoms";
import { ChangeKind, ChangeToPush } from "./model";

interface BrowserStorageArgs {
  settingsManager: SettingsManager;
  symptomManager: SymptomManager;
  metricManager: MetricManager;
  storage: LocalStorage;
}

export class BrowserStorage {
  private symptomManager: SymptomManager;
  private metricManager: MetricManager;
  private settingsManager: SettingsManager;
  private storage: LocalStorage;

  constructor({
    symptomManager,
    metricManager,
    storage,
    settingsManager,
  }: BrowserStorageArgs) {
    this.settingsManager = settingsManager;
    this.symptomManager = symptomManager;
    this.metricManager = metricManager;
    this.storage = storage;
  }

  public getSettings(): Settings {
    console.debug(`${BrowserStorage.name}.getSettings::reading settings from browser...`);
    const noSettings = {};

    if (this.storage.settings.exists() === false) {
      return noSettings;
    }

    const rawSettings = this.storage.settings.read();
    if (rawSettings === undefined) {
      return noSettings;
    }

    const settings = rawToSettings(rawSettings);

    return settings;
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

  public getChangesToPush(): ChangeToPush[] {
    if (this.storage.changesToPush.exists() === false) {
      return [];
    }

    const changesToPush = this.storage.changesToPush.read();
    if (!changesToPush) {
      return [];
    }

    const changes = changesToPush.map(deserializeChangeToPush);
    return changes;
  }

  public saveSettings(): void {
    return this.storage.settings.set(this.settingsManager.settings);
  }

  public saveAllSymptoms(): void {
    this.storage.symptoms.set(this.symptomManager.getAll());
  }

  public saveAllMetrics(): void {
    this.storage.history.set(this.metricManager.getAll());
  }

  public saveChangesToPush(changes: ChangeToPush[]): void {
    this.storage.changesToPush.set(changes);
  }
}

interface SerializedSettings extends Omit<Settings, "lastPulledAt"> {
  lastPulledAt?: string;
}

function rawToSettings(raw: SerializedSettings) {
  const settings: Settings = {
    apiUrl: raw.apiUrl,
    apiToken: raw.apiToken,
    lastPulledAt: raw.lastPulledAt ? deserializeDate(raw.lastPulledAt) : undefined,
  };
  return settings;
}

function deserializeSymptom(raw: any): Symptom {
  if (raw === null || raw === undefined) {
    throw unreachable();
  }

  const symptom: Symptom = { ...raw, lastModified: deserializeDate(raw.lastModified) };
  return symptom;
}

function deserializeMetric(raw: any): Metric {
  if (raw === null || raw === undefined) {
    throw unreachable();
  }

  const metric: Metric = {
    ...raw,
    date: deserializeDate(raw.date),
    lastModified: deserializeDate(raw.lastModified),
  };

  return metric;
}

function deserializeDate(raw: string): Date {
  return new Date(raw);
}

function deserializeChangeToPush(raw: any): ChangeToPush {
  if (raw === null || raw === undefined) {
    throw unreachable();
  }

  const kind = raw.kind as ChangeKind;
  switch (kind) {
    case "AddSymptom":
    case "UpdateSymptom": {
      const symptom = deserializeSymptom(raw.symptom);
      return { kind, symptom };
    }

    case "AddMetric":
    case "UpdateMetric": {
      const metric = deserializeMetric(raw.metric);
      return { kind, metric };
    }

    case "DeleteSymptom":
    case "DeleteMetric":
      return { kind, id: raw.id, deletionDate: deserializeDate(raw.deletionDate) };
  }
}

import { assertNever } from "../../exhaustive-match";
import { LocalStorage } from "../../localStorage";
import { BrowserStorage } from "../adapters/browserStorage";
import { RemoteStorage, RemoteStorageChange } from "../adapters/remoteStorage";
import { unreachable } from "../devex";
import { MetricChange, MetricManager } from "../domain/metrics";
import { Metric, MetricId, Symptom, SymptomId } from "../domain/model";
import { SettingsChange, SettingsManager } from "../domain/settings";
import { SymptomChange, SymptomManager } from "../domain/symptoms";
import { Result } from "safe-types";

interface ConstructorArgs {
  settingsManager: SettingsManager;
  storage: LocalStorage;
  symptomManager: SymptomManager;
  metricManager: MetricManager;
  browserStorage: BrowserStorage;
  remoteStorage: RemoteStorage;
}

export class App {
  public settingsManager: SettingsManager;
  public storage: LocalStorage;
  public symptomManager: SymptomManager;
  public metricManager: MetricManager;
  public browserStorage: BrowserStorage;
  public remoteStorage: RemoteStorage;

  constructor({
    settingsManager,
    storage,
    symptomManager,
    metricManager,
    browserStorage,
    remoteStorage,
  }: ConstructorArgs) {
    this.settingsManager = settingsManager;
    this.storage = storage;
    this.symptomManager = symptomManager;
    this.metricManager = metricManager;
    this.browserStorage = browserStorage;
    this.remoteStorage = remoteStorage;

    this.settingsManager.change$.subscribe((change) => {
      console.debug(`${App.name}.settingsManager::change:`, change);
      this.handleSettingsChange(change);
    });

    this.symptomManager.changes$.subscribe((change) => {
      console.debug(`${App.name}.symptomManager::change:`, change);
      this.handleSymptomChanges(change);
    });

    this.metricManager.changes$.subscribe((change) => {
      console.debug(`${App.name}.metricManager::change:`, change);
      this.handleMetricChanges(change);
    });

    this.remoteStorage.change$.subscribe((change) => {
      console.debug(`${App.name}.remoteStorage::change:`, change);
      this.handleRemoteStorageChanges(change);
    });
  }

  public initialize(): void {
    const _logPrefix = `${App.name}.initialize`;
    console.log(`${_logPrefix}::initialization started`);

    const settings = this.browserStorage.getSettings();
    console.log(`${_logPrefix}::settings found:`, settings);
    const symptoms = this.browserStorage.getSymptoms();
    console.log(`${_logPrefix}::${symptoms.length} symptoms found`);
    const metrics = this.browserStorage.getMetrics();
    console.log(`${_logPrefix}::${metrics.length} metrics found`);
    const changes = this.browserStorage.getChangesToPush();
    console.log(`${_logPrefix}::${changes.length} pending changes found`);

    this.settingsManager.initialize({ settings });
    this.symptomManager.initialize({ symptoms });
    this.metricManager.initialize({ metrics });
    this.remoteStorage.initialize({ changesToPush: changes });

    console.log(`${_logPrefix}::kicking-off backend loop`);

    this.remoteStorage.syncContinuously();

    console.log(`${_logPrefix}::initialization completed`);
  }

  /**
   * Push all data in device to API
   */
  public async pushAll(): Promise<Result<null, string>> {
    return this.remoteStorage.pushAll({
      symptoms: this.symptomManager.getAll(),
      metrics: this.metricManager.getAll(),
    });
  }

  private handleSettingsChange(change: SettingsChange): void {
    switch (change.kind) {
      case "SettingsInitialized":
        return;
      case "ApiUrlUpdated":
      case "ApiUrlDeleted":
      case "ApiTokenUpdated":
      case "ApiTokenDeleted":
      case "LastPulledDateUpdated":
      case "LastPulledDateDeleted":
        return this.browserStorage.saveSettings();
      default:
        assertNever(change, `unsupported SettingsChange variant: ${change}`);
    }
  }

  private handleSymptomChanges(change: SymptomChange): void {
    switch (change.kind) {
      case "SymptomManagerInitialized":
        return;
      case "SymptomsAddedFromExternalSource":
        return this.browserStorage.saveAllSymptoms();
      case "SymptomAdded":
        return this.addSymptomToStore(change.id);
      case "SymptomUpdated":
        return this.updateSymptomInStore(change.id);
      case "SymptomDeleted":
        return this.deleteSymptomFromStore(change.id);
      default:
        assertNever(change, `unsupported SymptomChange variant: ${change}`);
    }
  }

  private handleMetricChanges(change: MetricChange): void {
    switch (change.kind) {
      case "MetricManagerInitialized":
        return;
      case "MetricsAddedFromExternalSource":
        return this.browserStorage.saveAllMetrics();
      case "MetricAdded":
        return this.addMetricToStore(change.id);
      case "MetricUpdated":
        return this.updateMetricInStore(change.id);
      case "MetricDeleted":
        return this.deleteMetricFromStore(change.id);
      default:
        assertNever(change, `unsupported MetricChange variant: ${change}`);
    }
  }
  private handleRemoteStorageChanges(change: RemoteStorageChange): void {
    switch (change.kind) {
      case "SyncProcessStarted":
      case "SyncProcessCompleted":
        return;

      case "NewDataPulledFromApi":
        return this.sharePulledDataWithDomain(change.data);

      default:
        assertNever(change, `unsupported RemoteStorageChange variant: ${change}`);
    }
  }

  private addSymptomToStore(id: SymptomId): void {
    this.browserStorage.saveAllSymptoms();

    const symptom = this.symptomManager.get(id);
    if (symptom === undefined) {
      throw unreachable(`expected to find symptom=${id} but did not`);
    }
    this.remoteStorage.addSymptom({ symptom });
  }

  private updateSymptomInStore(id: SymptomId): void {
    this.browserStorage.saveAllSymptoms();

    const symptom = this.symptomManager.get(id);
    if (symptom === undefined) {
      throw unreachable(`expected to find symptom=${id} but did not`);
    }
    this.remoteStorage.updateSymptom({ symptom });
  }

  private deleteSymptomFromStore(id: SymptomId): void {
    this.browserStorage.saveAllSymptoms();
    this.remoteStorage.deleteSymptom({ id });
  }

  private addMetricToStore(id: MetricId): void {
    this.browserStorage.saveAllMetrics();

    const metric = this.metricManager.get(id);
    if (metric === undefined) {
      throw unreachable(`expected to find metric=${id} but did not`);
    }
    this.remoteStorage.addMetric({ metric });
  }

  private updateMetricInStore(id: MetricId): void {
    this.browserStorage.saveAllMetrics();

    const metric = this.metricManager.get(id);
    if (metric === undefined) {
      throw unreachable(`expected to find metric=${id} but did not`);
    }
    this.remoteStorage.updateMetric({ metric });
  }

  private deleteMetricFromStore(id: MetricId): void {
    this.browserStorage.saveAllMetrics();
    this.remoteStorage.deleteMetric({ id });
  }

  private sharePulledDataWithDomain({
    symptoms,
    metrics,
  }: {
    symptoms: Symptom[];
    metrics: Metric[];
  }): void {
    /**
     * Context:
     *   When the client receives new updates from the server, these changes must be
     *   persisted into the client's local storage and the domain must be notified too.
     *
     * This method takes care of sharing the pulled changes with the domain.
     */
    if (symptoms.length > 0) {
      this.symptomManager.addPulledData({ symptoms });
    }

    if (metrics.length > 0) {
      this.metricManager.addPulledData({ metrics });
    }
  }
}

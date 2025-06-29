import { PULL_OVERLAP_SECONDS, REMOTE_LOOP_WAIT } from "../../config";
import { assertNever } from "../../exhaustive-match";
import { now } from "../datetimeUtils";
import { MetricManager } from "../domain/metrics";
import { ErrorReason, Metric, MetricId, Symptom, SymptomId } from "../domain/model";
import { SettingsManager } from "../domain/settings";
import { SymptomManager } from "../domain/symptoms";
import { ApiError, HealthTrackerApi, ReadAllApiError } from "./api";
import { BrowserStorage } from "./browserStorage";
import { ChangeToPush } from "./model";
import { BehaviorSubject, Observable, Subject, delay, filter } from "rxjs";
import { Err, Ok, Result } from "safe-types";

const wait_ms = REMOTE_LOOP_WAIT * 1000;
const CHANGES_CANCEL_EACH_OTHER = "don't process, changes cancel each other";

enum ConnectionStatus {
  offline = "offline",
  missingConfig = "missingConfig",
  deviceReady = "deviceReady",
}

export enum SyncStatus {
  offline = "offline",
  offlinePendingPush = "offlinePendingPush",
  onlineButSyncFailed = "onlineButSyncFailed",
  onlineAndSynced = "onlineAndSynced",

  /* represents the state where you have recently add a change, so there are pending
    changes to push and you haven't tried to push again since last attempt, so maybe
    the connection is back, the settings have been fixed, etc. */
  waitingToSync = "onlineWaitingToSync",

  pulling = "pulling",
  pushing = "pushing",
}

interface ConstructorArgs {
  healthTrackerApi: HealthTrackerApi;
  browserStorage: BrowserStorage;
  settingsManager: SettingsManager;
  symptomManager: SymptomManager;
  metricManager: MetricManager;
}

export class RemoteStorage {
  public change$: Observable<RemoteStorageChange>;
  public syncStatus$: Observable<SyncStatus>;

  private changeSubject: Subject<RemoteStorageChange>;
  private syncStatusSubject: BehaviorSubject<SyncStatus>;
  private shouldProcess: boolean;
  private healthTrackerApi: HealthTrackerApi;
  private browserStorage: BrowserStorage;
  private settingsManager: SettingsManager;
  private symptomManager: SymptomManager;
  private metricManager: MetricManager;
  private changesToPush: Map<ChangesId, ChangeToPush>;

  constructor({
    healthTrackerApi,
    browserStorage,
    settingsManager,
    symptomManager,
    metricManager,
  }: ConstructorArgs) {
    this.shouldProcess = false;
    this.healthTrackerApi = healthTrackerApi;
    this.browserStorage = browserStorage;
    this.settingsManager = settingsManager;
    this.symptomManager = symptomManager;
    this.metricManager = metricManager;
    this.changesToPush = new Map<ChangesId, ChangeToPush>();

    this.changeSubject = new Subject<RemoteStorageChange>();
    this.change$ = this.changeSubject.asObservable();

    this.syncStatusSubject = new BehaviorSubject<SyncStatus>(SyncStatus.onlineAndSynced);
    this.syncStatus$ = this.syncStatusSubject.asObservable();

    this.syncStatus$.subscribe((change) =>
      console.debug(`${RemoteStorage.name}.syncStatus$::`, change)
    );

    this.change$.subscribe((change) =>
      console.debug(`${RemoteStorage.name}.change$::`, change)
    );

    // emits each time a process has completed
    const processCompletion$ = this.change$.pipe(
      filter((change) => change.kind === "SyncProcessCompleted")
    );

    const processStart$ = processCompletion$.pipe(delay(wait_ms));

    processStart$.subscribe(() => this.syncProcess());
  }

  public initialize({ changesToPush }: { changesToPush: ChangeToPush[] }): void {
    if (changesToPush.length === 0) {
      return;
    }

    for (const change of changesToPush) {
      const id = getChangeId(change);
      this.changesToPush.set(id, change);
    }

    this.syncStatusSubject.next(SyncStatus.waitingToSync);
  }

  public addSymptom({ symptom }: { symptom: Symptom }): void {
    this.queueChange({ kind: "AddSymptom", symptom });
  }

  public updateSymptom({ symptom }: { symptom: Symptom }): void {
    this.queueChange({ kind: "UpdateSymptom", symptom });
  }

  public deleteSymptom({ id }: { id: SymptomId }): void {
    this.queueChange({ kind: "DeleteSymptom", id, deletionDate: new Date() });
  }

  public addMetric({ metric }: { metric: Metric }): void {
    this.queueChange({ kind: "AddMetric", metric });
  }

  public updateMetric({ metric }: { metric: Metric }): void {
    this.queueChange({ kind: "UpdateMetric", metric });
  }

  public deleteMetric({ id }: { id: MetricId }): void {
    this.queueChange({ kind: "DeleteMetric", id, deletionDate: new Date() });
  }

  public syncContinuously(): void {
    this.shouldProcess = true;

    // kick-off the background processing
    this.syncProcess();
  }

  public async pushAll({
    symptoms,
    metrics,
  }: {
    symptoms: Symptom[];
    metrics: Metric[];
  }): Promise<Result<null, string>> {
    const _logPrefix = `${RemoteStorage.name}.${this.pushAll.name}`;

    // Check connectivity
    const status = this.getDeviceConnectionStatus();
    switch (status) {
      case ConnectionStatus.offline: {
        const reason = `did not attempt to push all to API because device is offline`;
        console.warn(`${_logPrefix}::${reason}`);
        this.changesToPush.size === 0
          ? this.syncStatusSubject.next(SyncStatus.offline)
          : this.syncStatusSubject.next(SyncStatus.offlinePendingPush);
        return Err(reason);
      }

      case ConnectionStatus.missingConfig: {
        const reason = `did not attempt to sync with API because some settings are missing`;
        console.warn(`${_logPrefix}::${reason}`);
        this.changesToPush.size === 0
          ? this.syncStatusSubject.next(SyncStatus.offline)
          : this.syncStatusSubject.next(SyncStatus.offlinePendingPush);
        return Err(reason);
      }

      case ConnectionStatus.deviceReady:
        break;

      default:
        assertNever(status, `unsupported ConnectionStatus variant: ${status}`);
    }

    // Start sync
    this.syncStatusSubject.next(SyncStatus.pushing);
    const result = await this.healthTrackerApi.pushAll({ symptoms, metrics });
    return result.match({
      Ok: ({ symptoms, metrics }) => {
        const failuresFound = symptoms.failed.length + metrics.failed.length > 0;
        if (failuresFound) {
          const totalSymptoms = symptoms.successful.length + symptoms.failed.length;
          const totalMetrics = metrics.successful.length + metrics.failed.length;
          this.syncStatusSubject.next(SyncStatus.onlineButSyncFailed);
          return Err(
            `${symptoms.failed.length}/${totalSymptoms} symptoms failed and ` +
              `${metrics.failed.length}/${totalMetrics} metrics failed`
          );
        }

        // Even if there are changes in the API that still do not exist in the device,
        // that's fine, show that the device is synced, it will pull any missing changes
        // on the next poll, as usual
        this.syncStatusSubject.next(SyncStatus.onlineAndSynced);

        return Ok(null);
      },
      Err: ({ reason }) => Err(reason),
    });
  }

  private getDeviceConnectionStatus(): ConnectionStatus {
    const _logPrefix = `${RemoteStorage.name}.${this.getDeviceConnectionStatus.name}`;
    if (this.deviceIsOffline()) {
      console.debug(`${_logPrefix}::device is offline`);
      return ConnectionStatus.offline;
    }

    if (this.healthTrackerApi.isConfigured() === false) {
      console.debug(`${_logPrefix}::missing settings to connect with API`);
      return ConnectionStatus.missingConfig;
    }

    return ConnectionStatus.deviceReady;
  }

  private queueChange(change: ChangeToPush): void {
    const id = getChangeId(change);
    const previous = this.changesToPush.get(id);
    if (previous === undefined) {
      this.changesToPush.set(id, change);
    } else {
      const latest = mergeChanges({ previous, current: change });
      if (latest === CHANGES_CANCEL_EACH_OTHER) {
        this.changesToPush.delete(id);
      } else {
        this.changesToPush.set(id, latest);
      }
    }

    this.browserStorage.saveChangesToPush([...this.changesToPush.values()]);
    this.syncStatusSubject.next(SyncStatus.waitingToSync);
  }

  private dequeueChange(change: ChangeToPush): void {
    const id = getChangeId(change);
    this.changesToPush.delete(id);
    this.browserStorage.saveChangesToPush([...this.changesToPush.values()]);
  }

  private async syncProcess(): Promise<void> {
    const _logPrefix = `${RemoteStorage.name}.${this.syncProcess.name}`;
    this.changeSubject.next({ kind: "SyncProcessStarted" });
    (await this.innerProcess()).match({
      Ok: () => {
        console.log(`${_logPrefix}::completed without errors`);
      },
      Err: (error) => {
        console.warn(`${_logPrefix}::completed with errors:`, error);
      },
    });

    this.changeSubject.next({ kind: "SyncProcessCompleted" });
  }

  private async innerProcess(): Promise<Result<null, ProcessError>> {
    const _logPrefix = `${RemoteStorage.name}.${this.innerProcess.name}`;

    // Check connectivity
    const status = this.getDeviceConnectionStatus();
    switch (status) {
      case ConnectionStatus.offline:
        console.warn(
          `${_logPrefix}::did not attempt to sync with API because device is offline`
        );
        this.changesToPush.size === 0
          ? this.syncStatusSubject.next(SyncStatus.offline)
          : this.syncStatusSubject.next(SyncStatus.offlinePendingPush);
        return Err({ kind: "DeviceIsOffline" });

      case ConnectionStatus.missingConfig:
        console.warn(
          `${_logPrefix}::did not attempt to sync with API because some settings are missing`
        );
        this.changesToPush.size === 0
          ? this.syncStatusSubject.next(SyncStatus.offline)
          : this.syncStatusSubject.next(SyncStatus.offlinePendingPush);
        return Err({ kind: "MissingConfig", reason: "missing config" });

      case ConnectionStatus.deviceReady:
        break;

      default:
        assertNever(status, `unsupported ConnectionStatus variant: ${status}`);
    }

    // Start sync
    this.syncStatusSubject.next(SyncStatus.pulling);

    const pulledResult = await this.pullLatestChanges();
    if (pulledResult.is_err()) {
      const error = pulledResult.unwrap_err();
      const { kind, reason } = error;
      switch (kind) {
        case "MissingConfig":
          console.warn(
            `${_logPrefix}::did not attempt to pull latest data from API, because API URL is not in settings`
          );
          this.syncStatusSubject.next(SyncStatus.offline);
          return Err(error);
        case "FailedToConnectWithApi":
          console.warn(`${_logPrefix}::failed reach API`);
          this.syncStatusSubject.next(SyncStatus.onlineButSyncFailed);
          return Err(error);
        case "FailedToGetAll":
          console.warn(`${_logPrefix}::failed while pulling latest data from API`);
          this.syncStatusSubject.next(SyncStatus.onlineButSyncFailed);
          return Err({ kind: "FailedToPullLatestChanges", reason });
        default:
          assertNever(kind, `unsupported ReadAllApiError variant: ${kind}`);
      }
    }

    const pulled = pulledResult.unwrap();

    // Remove stale 'changes to push' (aka, data in app layer)
    const toCompareWithDomain = this.comparePulledDataWithQueuedToPushData(pulled);

    // Remove stale pulled changes (aka, data in domain layer)
    const toShareWithDomain = this.comparePulledDataWithDomainData(toCompareWithDomain);

    if (toShareWithDomain.symptoms.length > 0 || toShareWithDomain.metrics.length > 0) {
      this.changeSubject.next({ kind: "NewDataPulledFromApi", data: toShareWithDomain });
    }

    this.syncStatusSubject.next(SyncStatus.pulling);
    const results = await this.pushPendingChanges();
    for (const result of results) {
      if (result.is_ok()) continue;
      const error = result.unwrap_err();
      if (error.kind === "FailedToConnectWithApi") {
        this.syncStatusSubject.next(SyncStatus.onlineButSyncFailed);
        return Err(error);
      }
    }

    this.syncStatusSubject.next(SyncStatus.onlineAndSynced);
    return Ok(null);
  }

  private deviceIsOffline(): boolean {
    if (this.healthTrackerApi.apiIsInLocalhost()) {
      return false;
    }

    return !navigator.onLine;
  }

  /**
   * Returs a date at point in time slighly earlier than the last pulled date.
   */
  private getLastPullDate(): Date {
    const date = this.settingsManager.settings.lastPulledAt;

    const epoch =
      date === undefined
        ? // This is the first time the client talks to the server, we want to
          // get every change published since the beginning of time
          0
        : // When pulling last changes, other clients can be pushing at the
          // same time. To avoid a race condition and miss data, shift the
          // 'last pulled' date back in time to create an overlap with the last
          // time we pulled from the server.
          date.getTime() - PULL_OVERLAP_SECONDS;

    if (epoch === 0) {
      console.debug(
        `${RemoteStorage.name}.${this.getLastPullDate.name}::no previous pull` +
          ` recorded in this device`
      );
    }

    return new Date(epoch);
  }

  private async pullLatestChanges(): Promise<
    Result<{ symptoms: Symptom[]; metrics: Metric[] }, ReadAllApiError>
  > {
    const _logPrefix = `${RemoteStorage.name}.${this.pullLatestChanges.name}`;
    console.debug(`${_logPrefix}::started`);

    const currentPullDate = now();

    const lastPullDate = this.getLastPullDate();

    const result = await this.healthTrackerApi.readAll({ publishedSince: lastPullDate });

    return result
      .tap(({ symptoms, metrics }) => {
        if (symptoms.length === 0 && metrics.length === 0) {
          console.debug(`${_logPrefix}::no new data pulled from API`);
        }

        this.settingsManager.setLastPulledAt(currentPullDate);
        console.debug(`${_logPrefix}::completed without errors`);
      })
      .tap_err((error) => console.debug(`${_logPrefix}::completed with errors`, error));
  }

  /**
   * Remove from the 'push-queue' any yet-to-push changes that must no longer be pushed
   * to the remote because a more recent version was pulled.
   */
  private comparePulledDataWithQueuedToPushData({
    symptoms,
    metrics,
  }: {
    symptoms: Symptom[];
    metrics: Metric[];
  }): {
    symptoms: Symptom[];
    metrics: Metric[];
  } {
    const _logPrefix = `${RemoteStorage.name}.${this.comparePulledDataWithQueuedToPushData.name}`;
    console.debug(`${_logPrefix}::started`);

    if (this.changesToPush.size === 0) {
      // there are no queued changes waiting to be pushed that might conflict with the
      // data pulled from the API
      console.debug(`${_logPrefix}::no changes to push found`);
      return { symptoms, metrics };
    }

    const toCompareWithDomain: {
      symptoms: Symptom[];
      metrics: Metric[];
    } = {
      symptoms: [],
      metrics: [],
    };

    for (const symptom of symptoms) {
      const { id } = symptom;
      const changeToPush = this.changesToPush.get(id);
      if (changeToPush === undefined) {
        // there are no changes queues waiting to be pushed that might conflict with
        // this symptom
        console.debug(`${_logPrefix}::symptom ${id}: no changes to push found`);
        continue;
      }

      if (symptom.lastModified.getTime() < getChangeDate(changeToPush).getTime()) {
        // the symptom fetched from the API is older, keep the change that was waiting
        // to be pushed so that it updates API data, and do not share the fetched
        // symptom with the domain as it's outdated now
        console.debug(`${_logPrefix}::symptom ${id}: pulled data is older`);
        continue;
      }

      // the symptom fetched from the API is newer, drop the change that was waiting to
      // be pushed so that the domain gets the API data
      console.debug(`${_logPrefix}::symptom ${id}: pulled data is newer`);
      toCompareWithDomain.symptoms.push(symptom);
      this.changesToPush.delete(id);
    }

    for (const metric of metrics) {
      const { id } = metric;
      const changeToPush = this.changesToPush.get(metric.id);
      if (changeToPush === undefined) {
        // there are no changes queues waiting to be pushed that might conflict with
        // this metric
        console.debug(`${_logPrefix}::metric ${id}: no changes to push found`);
        continue;
      }

      if (metric.lastModified.getTime() < getChangeDate(changeToPush).getTime()) {
        // the metric fetched from the API is older, keep the change that was waiting to
        // be pushed so that it updates API data, and do not share the fetched metric
        // with the domain as it's outdated now
        console.debug(`${_logPrefix}::metric ${id}: pulled data is older`);
        continue;
      }

      // the metric fetched from the API is newer, drop the change that was waiting to
      // be pushed so that the domain gets the API data
      console.debug(`${_logPrefix}::metric ${id}: pulled data is newer`);
      toCompareWithDomain.metrics.push(metric);
      this.changesToPush.delete(metric.id);
    }

    console.debug(`${_logPrefix}::completed`);

    return toCompareWithDomain;
  }

  private comparePulledDataWithDomainData({
    symptoms,
    metrics,
  }: {
    symptoms: Symptom[];
    metrics: Metric[];
  }): {
    symptoms: Symptom[];
    metrics: Metric[];
  } {
    const _logPrefix = `${RemoteStorage.name}.${this.comparePulledDataWithDomainData.name}`;
    console.debug(`${_logPrefix}::started`);

    const toShareWithDomain: {
      symptoms: Symptom[];
      metrics: Metric[];
    } = {
      symptoms: [],
      metrics: [],
    };

    for (const pulled of symptoms) {
      const { id } = pulled;
      const inDevice = this.symptomManager.get(id);

      if (inDevice === undefined) {
        toShareWithDomain.symptoms.push(pulled);
        console.debug(
          `${_logPrefix}::symptom ${id} does not exist locally, pulled symptom kept`
        );
        continue;
      }

      if (pulled.lastModified.getTime() < inDevice.lastModified.getTime()) {
        console.debug(
          `${_logPrefix}::symptom ${id} local version is newer than the pulled one,` +
            ` discarding pulled one`
        );
        continue;
      }

      console.debug(
        `${_logPrefix}::symptom ${id} local version is older than the pulled one,` +
          ` discarding local symptom`
      );
      toShareWithDomain.symptoms.push(pulled);
    }

    for (const pulled of metrics) {
      const { id } = pulled;
      const inDevice = this.metricManager.get(id);

      if (inDevice === undefined) {
        toShareWithDomain.metrics.push(pulled);
        console.debug(
          `${_logPrefix}::metric ${id} does not exist locally, pulled metric kept`
        );
        continue;
      }

      if (pulled.lastModified.getTime() < inDevice.lastModified.getTime()) {
        console.debug(
          `${_logPrefix}::metric ${id} local version is newer than the pulled one,` +
            ` discarding pulled one`
        );
        continue;
      }

      console.debug(
        `${_logPrefix}::metric ${id} local version is older than the pulled one,` +
          ` discarding local metric`
      );
      toShareWithDomain.metrics.push(pulled);
    }

    console.debug(`${_logPrefix}::completed`);

    return toShareWithDomain;
  }

  private async pushPendingChanges(): Promise<Result<null, ApiError>[]> {
    const _logPrefix = `${RemoteStorage.name}.${this.pushPendingChanges.name}`;
    console.log(`${_logPrefix}::found ${this.changesToPush.size} changes to push`);

    const changes: ChangeToPush[] = [...this.changesToPush.values()];
    const promises: Promise<Result<null, ApiError>>[] = changes.map(async (change) => {
      console.log(`${_logPrefix}::processing change:`, change);

      switch (change.kind) {
        case "AddSymptom": {
          const { symptom, kind } = change;
          const result = await this.healthTrackerApi.createSymptom({ symptom });
          return result.match({
            Ok: () => {
              this.dequeueChange(change);
              return Ok(null);
            },
            Err: (error) => {
              console.warn(
                `${_logPrefix}::failed to process change ${kind}, symptomId=${symptom.id}`
              );
              return Err(error);
            },
          });
        }

        case "UpdateSymptom": {
          const { symptom, kind } = change;
          const result = await this.healthTrackerApi.updateSymptom({ symptom });
          return result.match({
            Ok: () => {
              this.dequeueChange(change);
              return Ok(null);
            },
            Err: (error) => {
              console.warn(
                `${_logPrefix}::failed to process change ${kind}, symptomId=${symptom.id}`
              );
              return Err(error);
            },
          });
        }

        case "DeleteSymptom": {
          const { kind, id } = change;
          const result = await this.healthTrackerApi.deleteSymptom({ id });
          return result.match({
            Ok: () => {
              this.dequeueChange(change);
              return Ok(null);
            },
            Err: (error) => {
              console.warn(
                `${_logPrefix}::failed to process change ${kind}, symptomId=${id}`
              );
              switch (error.kind) {
                // If the symptom to delete does not exist in the API, perfect, job done
                case "SymptomDoesNotExit":
                  this.dequeueChange(change);
                  return Ok(null);
                case "MissingConfig":
                case "FailedToConnectWithApi":
                case "Other":
                  return Err(error);
                default:
                  assertNever(error, `unsupported variant: ${error}`);
              }
            },
          });
        }

        case "AddMetric": {
          const { metric, kind } = change;
          const result = await this.healthTrackerApi.createMetric({ metric });
          return result.match({
            Ok: () => {
              this.dequeueChange(change);
              return Ok(null);
            },
            Err: (error) => {
              console.warn(
                `${_logPrefix}::failed to process change ${kind}, metricId=${metric.id}`
              );
              return Err(error);
            },
          });
        }

        case "UpdateMetric": {
          const { metric, kind } = change;
          const result = await this.healthTrackerApi.updateMetric({ metric });
          return result.match({
            Ok: () => {
              this.dequeueChange(change);
              return Ok(null);
            },
            Err: (error) => {
              console.warn(
                `${_logPrefix}::failed to process change ${kind}, metricId=${metric.id}`
              );
              return Err(error);
            },
          });
        }

        case "DeleteMetric": {
          const { kind, id } = change;
          const result = await this.healthTrackerApi.deleteMetric({ id });
          return result.match({
            Ok: () => {
              this.dequeueChange(change);
              return Ok(null);
            },
            Err: (error) => {
              console.warn(
                `${_logPrefix}::failed to process change ${kind}, metricId=${id}`
              );
              switch (error.kind) {
                // If the metric to delete does not exist in the API, perfect, job done
                case "MetricDoesNotExit":
                  this.dequeueChange(change);
                  return Ok(null);
                case "MissingConfig":
                case "FailedToConnectWithApi":
                case "Other":
                  return Err(error);
                default:
                  assertNever(error, `unsupported variant: ${error}`);
              }
            },
          });
        }

        default:
          assertNever(change, `unsupported variant: ${change}`);
      }
    });

    const results = await Promise.all(promises);

    return results;
  }
}

export type RemoteStorageChange =
  | { kind: "SyncProcessStarted" }
  | { kind: "SyncProcessCompleted" }
  | {
      kind: "NewDataPulledFromApi";
      data: {
        symptoms: Symptom[];
        metrics: Metric[];
      };
    };

type ProcessError =
  | { kind: "DeviceIsOffline" }
  | { kind: "MissingConfig"; reason: ErrorReason }
  | { kind: "FailedToConnectWithApi"; reason: ErrorReason }
  | { kind: "FailedToPushLatestChanges"; reason: ErrorReason }
  | { kind: "FailedToPullLatestChanges"; reason: ErrorReason };

type ChangesId = SymptomId | MetricId;

function getChangeId(change: ChangeToPush): ChangesId {
  switch (change.kind) {
    case "AddSymptom":
    case "UpdateSymptom":
      return change.symptom.id;
    case "DeleteSymptom":
      return change.id;
    case "AddMetric":
    case "UpdateMetric":
      return change.metric.id;
    case "DeleteMetric":
      return change.id;
    default:
      assertNever(change, `unsupported variant: ${change}`);
  }
}

function getChangeDate(change: ChangeToPush): Date {
  switch (change.kind) {
    case "AddSymptom":
    case "UpdateSymptom":
      return change.symptom.lastModified;
    case "DeleteSymptom":
      return change.deletionDate;
    case "AddMetric":
    case "UpdateMetric":
      return change.metric.lastModified;
    case "DeleteMetric":
      return change.deletionDate;
    default:
      assertNever(change, `unsupported variant: ${change}`);
  }
}

enum ChangeKindCategory {
  add = "add",
  update = "update",
  delete = "delete",
}

function getChangeKindCategory(change: ChangeToPush): ChangeKindCategory {
  const { kind } = change;
  switch (kind) {
    case "AddSymptom":
    case "AddMetric":
      return ChangeKindCategory.add;
    case "UpdateSymptom":
    case "UpdateMetric":
      return ChangeKindCategory.update;
    case "DeleteSymptom":
    case "DeleteMetric":
      return ChangeKindCategory.delete;
    default:
      assertNever(kind, `unsupported ChangeKind variant: ${kind}`);
  }
}

function mergeChanges({
  previous, // the last queued change still not processed
  current, // a new change that just arrives and must be processed
}: {
  previous: ChangeToPush;
  current: ChangeToPush;
}): ChangeToPush | typeof CHANGES_CANCEL_EACH_OTHER {
  const previousDate = getChangeDate(previous).getTime();
  const currentDate = getChangeDate(current).getTime();

  // Find out which change happened earlier in time
  const [earliest, latest] =
    previousDate < currentDate ? [previous, current] : [current, previous];

  const earliestKind = getChangeKindCategory(earliest);
  const latestKind = getChangeKindCategory(latest);

  // auxiliary tool to compare a sorted pair of `ChangeKind`s
  const x = (a: ChangeKindCategory, b: ChangeKindCategory) => `${a}-${b}`;

  switch (x(earliestKind, latestKind)) {
    case x(ChangeKindCategory.add, ChangeKindCategory.delete):
      return CHANGES_CANCEL_EACH_OTHER;

    // In this case you've just updated something recently added (the "add" change has
    // not been processed yet), hence the resulting merged change must still be an "add"
    // change which contains the latest details
    case x(ChangeKindCategory.add, ChangeKindCategory.update): {
      return {
        ...latest, // copy the data of the latest changes
        kind: earliest.kind, // ensure it's the earliest (aka "add") change kind
      } as ChangeToPush;
    }

    case x(ChangeKindCategory.update, ChangeKindCategory.delete):
    case x(ChangeKindCategory.update, ChangeKindCategory.update):
      return latest;
    default:
      assertNever([earliestKind, latestKind] as never);
  }
}

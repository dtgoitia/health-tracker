import { LocalStorage } from "../../localStorage";
import { HealthTrackerApi } from "../adapters/api";
import { BrowserStorage } from "../adapters/browserStorage";
import { RemoteStorage } from "../adapters/remoteStorage";
import { MetricManager } from "../domain/metrics";
import { SettingsManager } from "../domain/settings";
import { SymptomManager } from "../domain/symptoms";
import { ErrorManager } from "../errors";
import { App } from "./app";

/**
 * Instantiate app and set up their dependencies. Initialization logic does not
 * happen here. Instead it's sent
 */
export function setUpApp(): App {
  const settingsManager = new SettingsManager();
  const storage = new LocalStorage();
  const symptomManager = new SymptomManager();
  const metricManager = new MetricManager();
  const browserStorage = new BrowserStorage({
    settingsManager,
    symptomManager,
    metricManager,
    storage,
  });
  const errorManager = new ErrorManager();
  const healthTrackerApi = new HealthTrackerApi({ settingsManager, errorManager });
  const remoteStorage = new RemoteStorage({
    healthTrackerApi,
    browserStorage,
    settingsManager,
    symptomManager,
    metricManager,
  });

  const app = new App({
    settingsManager,
    symptomManager,
    metricManager,
    storage,
    browserStorage,
    remoteStorage,
  });

  return app;
}

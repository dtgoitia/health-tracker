import { unreachable } from "../devex";
import { Settings } from "./model";
import { Observable, Subject } from "rxjs";

export type SettingsChange =
  | { readonly kind: "SettingsInitialized" }
  | { readonly kind: "ApiUrlUpdated"; readonly value: string }
  | { readonly kind: "ApiUrlDeleted" }
  | { readonly kind: "ApiTokenUpdated"; readonly value: string }
  | { readonly kind: "ApiTokenDeleted" }
  | { readonly kind: "LastPulledDateUpdated"; readonly value: Date }
  | { readonly kind: "LastPulledDateDeleted" };

export class SettingsManager {
  public settings: Settings;
  public change$: Observable<SettingsChange>;

  private changeSubject: Subject<SettingsChange>;
  private initialized = false;

  constructor() {
    this.settings = {};
    this.changeSubject = new Subject<SettingsChange>();
    this.change$ = this.changeSubject.asObservable();
    this.change$.subscribe((change) =>
      console.debug(`${SettingsManager.name}.change$:`, change)
    );
  }

  public initialize({ settings }: { settings: Settings }): void {
    if (this.initialized) {
      throw unreachable(`SettingsManager must be initialized only once`);
    }
    this.settings = settings;
    this.initialized = true;
    this.changeSubject.next({ kind: "SettingsInitialized" });
  }

  public setApiUrl(value: string | undefined): void {
    console.debug(`${SettingsManager.name}.setApiUrl::value:`, value);
    if (value === undefined || value === "") {
      const settings: Settings = { ...this.settings };
      delete settings["apiUrl"];
      this.settings = settings;
      this.changeSubject.next({ kind: "ApiUrlDeleted" });
    } else {
      this.settings = { ...this.settings, apiUrl: value };
      this.changeSubject.next({ kind: "ApiUrlUpdated", value });
    }
  }

  public setApiToken(value: string | undefined): void {
    console.debug(`${SettingsManager.name}.setApiToken::value:`, value);
    if (value === undefined || value === "") {
      const settings: Settings = { ...this.settings };
      delete settings["apiToken"];
      this.settings = settings;
      this.changeSubject.next({ kind: "ApiTokenDeleted" });
    } else {
      this.settings = { ...this.settings, apiToken: value };
      this.changeSubject.next({ kind: "ApiTokenUpdated", value });
    }
  }

  public setLastPulledAt(value: Date | undefined): void {
    console.debug(`${SettingsManager.name}.setLastPulledAt::value:`, value);
    if (value === undefined) {
      const settings: Settings = { ...this.settings };
      delete settings["lastPulledAt"];
      this.settings = settings;
      this.changeSubject.next({ kind: "LastPulledDateDeleted" });
    } else {
      this.settings = { ...this.settings, lastPulledAt: value };
      this.changeSubject.next({ kind: "LastPulledDateUpdated", value });
    }
  }
}

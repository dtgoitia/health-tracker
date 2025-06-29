import { useApp } from "..";
import CenteredPage from "../components/CenteredPage";
import NavBar from "../components/NavBar";
import { toISOStringWithLocalTimezone } from "../datetimeUtils";
import { assertNever } from "../exhaustive-match";
import BlueprintThemeProvider from "../style/theme";
import { Button, Card, IconName } from "@blueprintjs/core";
import { ChangeEvent, useEffect, useState } from "react";

enum PushingAllStatus {
  none = "none",
  ongoing = "ongoing",
  completed = "completed",
  failed = "failed",
}

function SettingsPage() {
  const app = useApp();

  const [apiUrl, setApiUrl] = useState<string>("");
  const [apiToken, setApiToken] = useState<string>("");
  const [pushAllStatus, setPushingAllStatue] = useState(PushingAllStatus.none);
  const [lastPull, setLastPull] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const subscription = app.settingsManager.change$.subscribe((change) => {
      setApiUrl(app.settingsManager.settings.apiUrl || "");
      setApiToken(app.settingsManager.settings.apiToken || "");
      setLastPull(app.settingsManager.settings.lastPulledAt);
    });

    setApiUrl(app.settingsManager.settings.apiUrl || "");
    setApiToken(app.settingsManager.settings.apiToken || "");
    setLastPull(app.settingsManager.settings.lastPulledAt);

    return () => subscription.unsubscribe();
  }, [app]);

  function handleApiUrlChange(event: ChangeEvent<HTMLInputElement>): void {
    const updated = event.target.value;
    setApiUrl(updated);
    app.settingsManager.setApiUrl(updated);
  }

  function handleApiTokenChange(event: ChangeEvent<HTMLInputElement>): void {
    const updated = event.target.value;
    setApiToken(updated);
    app.settingsManager.setApiToken(updated);
  }

  function handleLastPullClear(): void {
    const doNotClear =
      window.confirm(
        `Are you sure you want to clear the last-pulled-date? If there is no last` +
          `-pulled-date, the app will try to download all the data again next time.`
      ) === false;
    if (doNotClear) return;
    setLastPull(undefined);
    app.settingsManager.setLastPulledAt(undefined);
  }

  function handlePushAll(): void {
    setPushingAllStatue(PushingAllStatus.ongoing);
    app
      .pushAll()
      .then((result) =>
        result.match({
          Ok: () => setPushingAllStatue(PushingAllStatus.completed),
          Err: (error) => {
            console.error(`${SettingsPage.name}.handlePushAll::error:`, error);
            setPushingAllStatue(PushingAllStatus.failed);
          },
        })
      )
      .catch((error) => {
        console.error(`${SettingsPage.name}.handlePushAll::error:`, error);
        setPushingAllStatue(PushingAllStatus.failed);
      });
  }

  const { icon, text, disabled } = determinePushAllButtonIconAndText(pushAllStatus);

  return (
    <BlueprintThemeProvider>
      <CenteredPage>
        <NavBar />
        <h2>Settings</h2>
        <Card>
          <label>API URL</label>
          <input
            type="text"
            className="bp4-input bp4-fill"
            value={apiUrl}
            placeholder="https://foo.example"
            onChange={handleApiUrlChange}
          />

          <div style={{ paddingTop: "1rem" }}>
            <label>API token</label>
            <input
              type="text"
              className="bp4-input bp4-fill"
              value={apiToken}
              onChange={handleApiTokenChange}
            />
          </div>
        </Card>

        <Card style={{ marginTop: "1rem" }}>
          <div>
            <span>
              Last sync: {lastPull ? toISOStringWithLocalTimezone(lastPull) : "---"}
            </span>
            <span>
              {lastPull ? (
                <Button
                  type="button"
                  className="bp4-button"
                  onClick={handleLastPullClear}
                  icon="trash"
                />
              ) : null}
            </span>
          </div>

          <div>
            <Button
              type="button"
              className="bp4-button"
              onClick={handlePushAll}
              disabled={disabled}
              icon={icon}
              text={text}
            />
          </div>
        </Card>
      </CenteredPage>
    </BlueprintThemeProvider>
  );
}

export default SettingsPage;

function determinePushAllButtonIconAndText(status: PushingAllStatus): {
  icon: IconName;
  text: string;
  disabled: boolean;
} {
  switch (status) {
    case PushingAllStatus.none:
      return { icon: "upload", text: "Click to push all", disabled: false };
    case PushingAllStatus.ongoing:
      return { icon: "repeat", text: "pushing all, wait...", disabled: true };
    case PushingAllStatus.completed:
      return { icon: "tick", text: "Done! Click to push all again", disabled: false };
    case PushingAllStatus.failed:
      return {
        icon: "error",
        text: "Failed! Click to try to push all again",
        disabled: false,
      };
    default:
      assertNever(status, `unsupported status variant: ${status}`);
  }
}

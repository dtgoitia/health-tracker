import {
  ErrorReason,
  Intensity,
  Metric,
  MetricId,
  Symptom,
  SymptomId,
} from "../domain/model";
import { SettingsManager } from "../domain/settings";
import { ErrorManager } from "../errors";
import { Client } from "browser-http-client";
import { Err, Ok, Result } from "safe-types";

export type ApiError =
  | { kind: "MissingConfig"; reason: ErrorReason }
  | { kind: "FailedToConnectWithApi"; reason: ErrorReason }
  | { kind: "FailedToCreateSymptom"; reason: ErrorReason }
  | { kind: "FailedToUpdateSymptom"; reason: ErrorReason }
  | { kind: "FailedToDeleteSymptom"; reason: ErrorReason }
  | { kind: "FailedToCreateMetric"; reason: ErrorReason }
  | { kind: "FailedToUpdateMetric"; reason: ErrorReason }
  | { kind: "FailedToDeleteMetric"; reason: ErrorReason }
  | { kind: "FailedToGetAll"; reason: ErrorReason };

export type DeleteSymptomError =
  | { kind: "MissingConfig"; reason: ErrorReason }
  | { kind: "FailedToConnectWithApi"; reason: ErrorReason }
  | { kind: "SymptomDoesNotExit" }
  | { kind: "Other"; reason: ErrorReason };

export type DeleteMetricError =
  | { kind: "MissingConfig"; reason: ErrorReason }
  | { kind: "FailedToConnectWithApi"; reason: ErrorReason }
  | { kind: "MetricDoesNotExit" }
  | { kind: "Other"; reason: ErrorReason };

export type ReadAllApiError =
  | { kind: "MissingConfig"; reason: ErrorReason }
  | { kind: "FailedToConnectWithApi"; reason: ErrorReason }
  | { kind: "FailedToGetAll"; reason: ErrorReason };

export type PushAllApiError =
  | { kind: "MissingConfig"; reason: ErrorReason }
  | { kind: "FailedToConnectWithApi"; reason: ErrorReason }
  | { kind: "FailedToPushAll"; reason: ErrorReason };

interface ConstructorArgs {
  settingsManager: SettingsManager;
  errorManager: ErrorManager;
}

export class HealthTrackerApi {
  private settingsManager: SettingsManager;
  private errorManager: ErrorManager;

  constructor({ settingsManager, errorManager }: ConstructorArgs) {
    this.settingsManager = settingsManager;
    this.errorManager = errorManager;
  }

  public isOnline(): boolean {
    const apiUrl = this.settingsManager.settings.apiUrl;
    if (apiUrl === undefined) return false;
    if (this.apiIsInLocalhost()) return true;
    return navigator.onLine;
  }

  public apiIsInLocalhost(): boolean {
    const apiUrl = this.settingsManager.settings.apiUrl;
    if (apiUrl === undefined) return false;

    if (apiUrl.startsWith("http://localhost")) return true;
    if (apiUrl.startsWith("http://127.0.0.1")) return true;

    return false;
  }

  public isConfigured(): boolean {
    const apiUrlSet = this.settingsManager.settings.apiUrl !== undefined;
    const apiTokenSet = this.settingsManager.settings.apiToken !== undefined;
    return apiUrlSet && apiTokenSet;
  }

  public async createSymptom({
    symptom,
  }: {
    symptom: Symptom;
  }): Promise<Result<Symptom, ApiError>> {
    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const url = `${baseUrl}/symptoms`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    const payload: CreateSymptomRequestBody = map.symptom.domainToApi(symptom);

    const response = await Client.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    return response.match({
      Ok: ({ data }) => {
        return map.symptom.apiToDomain(data.created_symptom).match({
          Ok: (symptom) => Ok(symptom),
          Err: (reason) => {
            const error = `failed to map API response to Symptom, reason: ${reason}`;
            this.errorManager.add({
              header: "Unexpected API response",
              description: error,
            });
            return Err({ kind: "FailedToCreateSymptom", reason: error });
          },
        });
      },
      Err: (error) => {
        const reason =
          "response" in error && error.response.status === 0
            ? "Cannot reach the server"
            : JSON.stringify(error, null, 2);

        this.errorManager.add({
          header: "Failed to create Symptom",
          description: reason,
        });

        return Err({ kind: "FailedToConnectWithApi", reason });
      },
    });
  }

  public async updateSymptom({
    symptom,
  }: {
    symptom: Symptom;
  }): Promise<Result<Symptom, ApiError>> {
    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const apiSymtom = map.symptom.domainToApi(symptom);

    const url = `${baseUrl}/symptoms/${symptom.id}`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    const payload: UpdateSymptomRequestBody = {
      name: apiSymtom.name,
      other_names: apiSymtom.other_names,
      updated_at: apiSymtom.updated_at,
    };

    const response = await Client.patch<UpdateSymptomResponseBody>(url, payload, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    return response.match({
      Ok: ({ data }) => {
        const { updated_symptom, error } = data;
        if (error !== undefined) {
          return Err({ kind: "FailedToUpdateSymptom", reason: error });
        }
        return map.symptom.apiToDomain(updated_symptom as ApiSymptom).match({
          Ok: (symptom) => Ok(symptom),
          Err: (reason) => {
            const error = `failed to map API response to Symptom, reason: ${reason}`;
            this.errorManager.add({
              header: "Unexpected API response",
              description: error,
            });
            return Err({ kind: "FailedToUpdateSymptom", reason: error });
          },
        });
      },
      Err: (error) => {
        const reason =
          "response" in error && error.response.status === 0
            ? "Cannot reach the server"
            : JSON.stringify(error, null, 2);

        this.errorManager.add({
          header: "Failed to update Symptom",
          description: reason,
        });
        return Err({ kind: "FailedToConnectWithApi", reason });
      },
    });
  }

  public async deleteSymptom({
    id,
  }: {
    id: SymptomId;
  }): Promise<Result<null, DeleteSymptomError>> {
    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const url = `${baseUrl}/symptoms/${id}`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    const client = new Client<DeleteSymptomResponseBody, any>("delete", url);
    client.addHeaders(authHeaders);

    const response = await client.send();

    return response.match({
      Ok: () => Ok(null),
      Err: (error) => {
        // TODO: I think the library has a way to handle this in an easier manner
        // look for `ClientErrMatcher` in the library in GitHub
        return interpretError(error as unknown as HackyClientError).match({
          Ok: ({ status, reason }) => {
            this.errorManager.add({
              header: "Failed to delete Symptom",
              description: reason,
            });

            if (status === 0) {
              return Err({ kind: "FailedToConnectWithApi", reason });
            }

            if (status === 404) {
              return Err({ kind: "SymptomDoesNotExit" });
            }

            return Err({ kind: "Other", reason });
          },
          Err: () => Err({ kind: "FailedToConnectWithApi", reason: "unknown" }),
        });
      },
    });
  }

  public async createMetric({
    metric,
  }: {
    metric: Metric;
  }): Promise<Result<Metric, ApiError>> {
    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const url = `${baseUrl}/metrics`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    const payload: CreateMetricRequestBody = map.metric.domainToApi(metric);

    const response = await Client.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    return response.match({
      Ok: ({ data }) => {
        return map.metric.apiToDomain(data.created_metric).match({
          Ok: (metric) => Ok(metric),
          Err: (reason) => {
            const error = `failed to map API response to Metric, reason: ${reason}`;
            this.errorManager.add({
              header: "Unexpected API response",
              description: error,
            });
            return Err({ kind: "FailedToCreateMetric", reason: error });
          },
        });
      },
      Err: (error) => {
        const reason =
          "response" in error && error.response.status === 0
            ? "Cannot reach the server"
            : JSON.stringify(error, null, 2);

        this.errorManager.add({
          header: "Failed to create Metric",
          description: reason,
        });

        return Err({ kind: "FailedToConnectWithApi", reason });
      },
    });
  }

  public async updateMetric({
    metric,
  }: {
    metric: Metric;
  }): Promise<Result<Metric, ApiError>> {
    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const apiSymtom = map.metric.domainToApi(metric);

    const url = `${baseUrl}/metrics/${metric.id}`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    const payload: UpdateMetricRequestBody = {
      symptom_id: apiSymtom.symptom_id,
      date: apiSymtom.date,
      updated_at: apiSymtom.updated_at,
      intensity: apiSymtom.intensity,
      notes: apiSymtom.notes,
    };

    const response = await Client.patch<UpdateMetricResponseBody>(url, payload, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    return response.match({
      Ok: ({ data }) => {
        const { updated_metric, error } = data;
        if (error !== undefined) {
          return Err({ kind: "FailedToUpdateMetric", reason: error });
        }
        return map.metric.apiToDomain(updated_metric as ApiMetric).match({
          Ok: (metric) => Ok(metric),
          Err: (reason) => {
            const error = `failed to map API response to Metric, reason: ${reason}`;
            this.errorManager.add({
              header: "Unexpected API response",
              description: error,
            });
            return Err({ kind: "FailedToUpdateMetric", reason: error });
          },
        });
      },
      Err: (error) => {
        const reason =
          "response" in error && error.response.status === 0
            ? "Cannot reach the server"
            : JSON.stringify(error, null, 2);

        this.errorManager.add({
          header: "Failed to update Metric",
          description: reason,
        });
        return Err({ kind: "FailedToConnectWithApi", reason });
      },
    });
  }

  public async deleteMetric({
    id,
  }: {
    id: MetricId;
  }): Promise<Result<null, DeleteMetricError>> {
    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const url = `${baseUrl}/metrics/${id}`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    const client = new Client<DeleteMetricResponseBody, any>("delete", url);
    client.addHeaders(authHeaders);

    const response = await client.send();

    return response.match({
      Ok: () => Ok(null),
      Err: (error) => {
        // TODO: I think the library has a way to handle this in an easier manner
        // look for `ClientErrMatcher` in the library in GitHub
        return interpretError(error as unknown as HackyClientError).match({
          Ok: ({ status, reason }) => {
            this.errorManager.add({
              header: "Failed to delete Metric",
              description: reason,
            });

            if (status === 0) {
              return Err({ kind: "FailedToConnectWithApi", reason });
            }

            if (status === 404) {
              return Err({ kind: "MetricDoesNotExit" });
            }

            return Err({ kind: "Other", reason });
          },
          Err: () => Err({ kind: "FailedToConnectWithApi", reason: "unknown" }),
        });
      },
    });
  }

  public async readAll({
    publishedSince,
  }: {
    publishedSince: Date;
  }): Promise<Result<{ symptoms: Symptom[]; metrics: Metric[] }, ReadAllApiError>> {
    const _logPrefix = `${HealthTrackerApi.name}.${this.readAll.name}`;

    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const url = `${baseUrl}/get-all`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    const client = new Client<ReadAllResponseBody, any>("get", url);
    client.addHeaders(authHeaders);
    client.addQueryObj({ published_since: publishedSince.toISOString() });

    console.debug(`${_logPrefix}::pulling API data published since ${publishedSince}`);
    const response = await client.send();

    return response.match({
      Ok: ({ data }) => {
        const errors: ErrorReason[] = [];
        const symptoms: Symptom[] = [];
        const metrics: Metric[] = [];

        for (const apiSymptom of data.symptoms) {
          map.symptom.apiToDomain(apiSymptom).match({
            Ok: (symptom) => {
              symptoms.push(symptom);
            },
            Err: (error) => {
              errors.push(error);
            },
          });
        }

        for (const apiMetric of data.metrics) {
          map.metric.apiToDomain(apiMetric).match({
            Ok: (metric) => {
              metrics.push(metric);
            },
            Err: (error) => {
              errors.push(error);
            },
          });
        }

        return Ok({ symptoms, metrics });
      },

      Err: (error) => {
        // TODO: I think the library has a way to handle this in an easier manner
        // look for `ClientErrMatcher` in the library in GitHub
        return interpretError(error as unknown as HackyClientError).match({
          Ok: ({ status, reason }) => {
            this.errorManager.add({
              header: "Failed get all",
              description: reason,
            });

            if (status === 0) {
              return Err({ kind: "FailedToConnectWithApi", reason });
            }
            return Err({ kind: "FailedToGetAll", reason });
          },
          Err: () => Err({ kind: "FailedToConnectWithApi", reason: "unknown" }),
        });
      },
    });
  }

  public async pushAll({
    symptoms,
    metrics,
  }: {
    symptoms: Symptom[];
    metrics: Metric[];
  }): Promise<Result<PushAllResponseBody, PushAllApiError>> {
    const _logPrefix = `${HealthTrackerApi.name}.${this.pushAll.name}`;

    const baseUrl = this.getBaseUrl();
    if (baseUrl === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API URL found" });
    }

    const url = `${baseUrl}/push-all`;
    const authHeaders = this.getAuthHeaders();
    if (authHeaders === undefined) {
      return Err({ kind: "MissingConfig", reason: "no API token found" });
    }

    console.debug(`${_logPrefix}::pushing all local changes to API`);
    const payload: PushAllRequestBody = {
      symptoms: symptoms.map((symptom) => map.symptom.domainToApi(symptom)),
      metrics: metrics.map((metric) => map.metric.domainToApi(metric)),
    };

    const response = await Client.post<PushAllResponseBody>(url, payload, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    return response.match({
      Ok: ({ data: { symptoms, metrics } }) => Ok({ symptoms, metrics }),
      Err: (error) => {
        const reason =
          "response" in error && error.response.status === 0
            ? "Cannot reach the server"
            : JSON.stringify(error, null, 2);

        this.errorManager.add({
          header: "Failed push all",
          description: reason,
        });
        return Err({ kind: "FailedToConnectWithApi", reason });
      },
    });
  }

  private getBaseUrl(): string | undefined {
    const urlInSetting = this.settingsManager.settings.apiUrl;
    if (urlInSetting === undefined) {
      this.errorManager.add({
        header: "API URL not found",
        description: "Could not find API URL in Settings",
      });
      return;
    }

    // Drop trailing `/` if any
    const url = urlInSetting.replace(/\/$/, "");

    return url;
  }

  private getAuthHeaders(): { "x-api-key": string } | undefined {
    const apiToken = this.settingsManager.settings.apiToken;
    if (apiToken === undefined) {
      this.errorManager.add({
        header: "API token not found",
        description: "Could not find API token in Settings",
      });
      return undefined;
    }

    return { "x-api-key": apiToken };
  }
}

interface ApiSymptom {
  id: string;
  name: string;
  other_names: string[];
  updated_at: string;
}

interface ApiMetric {
  id: string;
  symptom_id: string;
  date: string;
  updated_at: string;
  intensity: string;
  notes: string;
}

type CreateSymptomRequestBody = ApiSymptom;
type UpdateSymptomRequestBody = Omit<ApiSymptom, "id">;
type UpdateSymptomResponseBody =
  | { updated_symptom: ApiSymptom; error: undefined }
  | { updated_symptom: undefined; error: string };

type DeleteSymptomResponseBody = { deleted_symptom: SymptomId };

type CreateMetricRequestBody = ApiMetric;
type UpdateMetricRequestBody = Omit<ApiMetric, "id">;

type UpdateMetricResponseBody =
  | { updated_metric: ApiMetric; error: undefined }
  | { updated_metric: undefined; error: string };

type DeleteMetricResponseBody = { deleted_metric: MetricId };

type ReadAllResponseBody = { symptoms: ApiSymptom[]; metrics: ApiMetric[] };

type PushAllRequestBody = { symptoms: ApiSymptom[]; metrics: ApiMetric[] };

type PushAllResponseBody = {
  symptoms: {
    successful: SymptomId[];
    failed: Symptom[];
  };
  metrics: {
    successful: MetricId[];
    failed: MetricId[];
  };
};

const map = {
  symptom: {
    domainToApi: function (symptom: Symptom): ApiSymptom {
      return {
        id: symptom.id,
        name: symptom.name,
        other_names: symptom.otherNames,
        updated_at: symptom.lastModified.toISOString(),
      };
    },
    apiToDomain: function (apiSymptom: ApiSymptom): Result<Symptom, ErrorReason> {
      const updatedAt = dateFromString(apiSymptom.updated_at);
      if (updatedAt.is_err()) {
        return Err(updatedAt.err().unwrap());
      }

      return Ok({
        id: apiSymptom.id,
        name: apiSymptom.name,
        otherNames: apiSymptom.other_names,
        lastModified: updatedAt.unwrap(),
      });
    },
  },
  metric: {
    domainToApi: function (metric: Metric): ApiMetric {
      return {
        id: metric.id,
        symptom_id: metric.symptomId,
        date: metric.date.toISOString(),
        updated_at: metric.lastModified.toISOString(),
        intensity: metric.intensity,
        notes: metric.notes,
      };
    },
    apiToDomain: function (apiMetric: ApiMetric): Result<Metric, ErrorReason> {
      const updatedAt = dateFromString(apiMetric.updated_at);
      if (updatedAt.is_err()) {
        return Err(updatedAt.err().unwrap());
      }

      const date = dateFromString(apiMetric.date);
      if (date.is_err()) {
        return Err(date.err().unwrap());
      }

      const intensity = intensityFromString(apiMetric.intensity);
      if (intensity.is_err()) {
        return Err(intensity.err().unwrap());
      }

      return Ok({
        id: apiMetric.id,
        symptomId: apiMetric.symptom_id,
        date: date.unwrap(),
        lastModified: updatedAt.unwrap(),
        intensity: intensity.unwrap(),
        notes: apiMetric.notes,
      });
    },
  },
};

function dateFromString(s: string): Result<Date, ErrorReason> {
  const epoch = Date.parse(s);
  if (isNaN(epoch)) {
    return Err(`cannot parse '${s}' into a Date`);
  }
  const date = new Date(epoch);
  return Ok(date);
}

function intensityFromString(s: string): Result<Intensity, ErrorReason> {
  switch (s) {
    case Intensity.high:
      return Ok(Intensity.high);
    case Intensity.medium:
      return Ok(Intensity.medium);
    case Intensity.low:
      return Ok(Intensity.low);
    default:
      return Err(`cannot parse '${s}' into Intensity`);
  }
}

interface HackyClientError {
  response: {
    status: number;
    data: {
      error: object | undefined;
    };
  };
}

type HttpStatusCode = number;

interface CustomError {
  status: HttpStatusCode;
  reason: ErrorReason;
}

function interpretError(error: HackyClientError): Result<CustomError, undefined> {
  const status = error.response.status;
  switch (status) {
    case 0:
      return Ok({ status: 0, reason: "cannot reach the server" });
    case 400:
    case 401:
    case 404:
    case 409:
    case 422:
      const data = error.response.data;
      if (data) {
        const reason = data.error;
        if (typeof reason === "string") {
          return Ok({ status, reason });
        } else {
          return Ok({ status, reason: JSON.stringify(reason, null, 2) });
        }
      }

      return Ok({ status, reason: JSON.stringify(data, null, 2) });
  }

  return Err(undefined);
}

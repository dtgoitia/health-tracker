export type ISODatetimeString = string; // "2022-07-19T07:11:00+01:00"
export type ISODateString = string; // "2022-07-19"

export type ErrorReason = string;

export type Hash = string;

export type SymptomId = string;
export type MetricId = string;
export type SymptomName = string;

export interface Symptom {
  id: SymptomId;
  name: SymptomName;
  otherNames: SymptomName[];
  lastModified: Date;
}

export enum Intensity {
  low = "low",
  medium = "medium",
  high = "high",
}

export type Notes = string;

export interface Metric {
  id: MetricId;
  symptomId: SymptomId;
  intensity: Intensity;
  date: Date;
  notes: Notes;
  lastModified: Date;
}

export type FilterQuery = string;

export interface Settings {
  apiUrl?: string;
  apiToken?: string;
  lastPulledAt?: Date; // last time when data was successfully read from the API
}

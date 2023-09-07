import { Metric, MetricId, Symptom, SymptomId } from "../domain/model";

export type ChangeToPush =
  | { kind: "AddSymptom"; symptom: Symptom }
  | { kind: "UpdateSymptom"; symptom: Symptom }
  | { kind: "DeleteSymptom"; id: SymptomId; deletionDate: Date }
  | { kind: "AddMetric"; metric: Metric }
  | { kind: "UpdateMetric"; metric: Metric }
  | { kind: "DeleteMetric"; id: MetricId; deletionDate: Date };

export type ChangeKind = ChangeToPush["kind"];

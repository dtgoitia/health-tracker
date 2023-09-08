import { Metric, Symptom, SymptomId } from "../domain/model";

export function filterMetrics({
  symptomsToShow,
  metrics,
}: {
  symptomsToShow: Symptom[];
  metrics: Metric[];
}): Metric[] {
  const symptoms = new Set<SymptomId>(symptomsToShow.map((symptom) => symptom.id));
  return metrics.filter((metric) => symptoms.has(metric.symptomId));
}

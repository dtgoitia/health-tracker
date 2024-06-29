import { now } from "../datetimeUtils";
import { Symptom, SymptomId, SymptomName } from "../domain/model";
import { SYMPTOM_PREFIX } from "../domain/symptoms";
import { generateId } from "../hash";

export function buildSymptom({
  id,
  name,
}: {
  id?: SymptomId;
  name?: SymptomName;
}): Symptom {
  return {
    id: id ? id : generateId({ prefix: SYMPTOM_PREFIX }),
    name: name ? name : "test activity",
    otherNames: [],
    lastModified: now(),
  };
}

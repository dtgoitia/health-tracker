import NumericIntensitySelector, {
  numberIntensityToIntensity,
  NumericIntensity,
  parseNotes,
} from "../../components/NumericIntensitySelector";
import { Symptom, SymptomId, Intensity, Notes } from "../../lib/domain/model";
import { findSymptomById } from "../../lib/domain/symptoms";
import { Button } from "@blueprintjs/core";
import { useState } from "react";
import styled from "styled-components";

const ButtonsLabel = styled.label`
  padding-right: 1rem;
`;
const ButtonRibbon = styled.div`
  margin: 1rem 0;
`;

type IntensityNumber = number;

interface AddMetricProps {
  symptoms: Symptom[];
  selectedSymptomId?: SymptomId;
  record: (id: SymptomId, intensity: Intensity, notes: Notes) => void;
}
function AddMetric({ symptoms, selectedSymptomId, record }: AddMetricProps) {
  const [intensity, setIntensity] = useState<Intensity | undefined>();
  const [notes, setNotes] = useState<string>("");

  function handleSubmit(event: any) {
    event.preventDefault();
    if (!selectedSymptomId) return;
    if (!intensity) {
      console.debug(`Intensity is required to add a metric`);
      return;
    }
    record(selectedSymptomId, intensity as Intensity, notes);
    setIntensity(undefined);
    setNotes("");
  }

  function handleNotesChange(event: any) {
    setNotes(event.target.value);
  }

  function handleNumericIntensityChange(nIntensity: NumericIntensity): void {
    const { notes: trimmedNotes } = parseNotes(notes);
    const intensity = numberIntensityToIntensity(nIntensity);
    let updatedNotes = `${nIntensity}/10`;
    if (trimmedNotes) {
      updatedNotes += ` - ${trimmedNotes}`;
    }

    setIntensity(intensity);
    setNotes(updatedNotes);
  }

  const intensityButtons = Object.keys(Intensity).map((key) => {
    const buttonIntensity = key as Intensity;
    const classNameIfSelected = buttonIntensity === intensity ? "bp4-intent-success" : "";
    return (
      <button
        key={key}
        type="button"
        className={`bp4-button bp4-large ${classNameIfSelected}`}
        onClick={() => {
          setIntensity(buttonIntensity);
          setNotes("");
        }}
      >
        {buttonIntensity}
      </button>
    );
  });

  const canSubmit = selectedSymptomId !== undefined && intensity !== undefined;

  let selectedSymptom = undefined;
  if (selectedSymptomId) {
    selectedSymptom = findSymptomById(symptoms, selectedSymptomId);
  }

  return (
    <form onSubmit={canSubmit ? handleSubmit : () => {}}>
      <p>Add a new metric:</p>
      <div>{selectedSymptom?.name}</div>
      <ButtonRibbon>
        <ButtonsLabel>intensity</ButtonsLabel>
        <div className="bp4-button-group .modifier">{intensityButtons}</div>
      </ButtonRibbon>
      <NumericIntensitySelector
        selected={parseNotes(notes).nIntensity}
        onSelect={handleNumericIntensityChange}
      />
      <input
        id="form-group-input"
        type="text"
        className="bp4-input"
        value={notes}
        placeholder="add observations here..."
        onChange={handleNotesChange}
      />
      <Button disabled={!canSubmit} intent="success" text="Add" type="submit" />
    </form>
  );
}
export default AddMetric;

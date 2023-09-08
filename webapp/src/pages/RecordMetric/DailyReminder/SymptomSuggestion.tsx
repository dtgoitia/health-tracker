import IntensitySelector from "../../../components/IntensitySelector";
import { Symptom, SymptomId } from "../../../lib/domain/model";
import { Intensity } from "../../../lib/domain/model";
import { Button } from "@blueprintjs/core";
import { useState } from "react";
import styled from "styled-components";

interface Props {
  symptom: Symptom;
  onSuggestionClick: (id: SymptomId, intensity: Intensity) => void;
}
function SymptomSuggestion({ symptom, onSuggestionClick: addMetric }: Props) {
  const [intensity, setIntensity] = useState<Intensity>(Intensity.medium);

  function handleAdd(): void {
    addMetric(symptom.id, intensity);
  }

  return (
    <Container>
      <Name>{symptom.name}</Name>
      <IntensitySelector selectedIntensity={intensity} onSelect={setIntensity} />
      <Button text="Add" large onClick={handleAdd} />
    </Container>
  );
}

export default SymptomSuggestion;

const Container = styled.div`
  display: flex;
`;
const Name = styled.div`
  align-self: center;
`;

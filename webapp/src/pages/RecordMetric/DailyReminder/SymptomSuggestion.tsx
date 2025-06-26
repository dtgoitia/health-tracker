import IntensitySelector from "../../../components/IntensitySelector";
import { Metric, Notes, SymptomId, SymptomName } from "../../../lib/domain/model";
import { Intensity } from "../../../lib/domain/model";
import { SymptomManager } from "../../../lib/domain/symptoms";
import { Button } from "@blueprintjs/core";
import { useEffect, useState } from "react";
import styled from "styled-components";

interface Props {
  pastMetric: Metric;
  onSuggestionClick: (id: SymptomId, intensity: Intensity, notes: Notes) => void;
  symptomManager: SymptomManager;
  alreadyRecordedToday: boolean;
}
function SymptomSuggestion({
  pastMetric,
  onSuggestionClick: addMetric,
  symptomManager,
  alreadyRecordedToday,
}: Props) {
  const [name, setName] = useState<SymptomName | undefined>(undefined);
  const [intensity, setIntensity] = useState<Intensity>(Intensity.medium);

  useEffect(() => {
    function setSymptomState(): void {
      const symptom = symptomManager.get(pastMetric.symptomId);
      if (symptom === undefined) return;
      setName(symptom.name);
    }
    const subscription = symptomManager.changes$.subscribe(() => {
      setSymptomState();
    });

    setSymptomState();

    return () => {
      subscription.unsubscribe();
    };
  }, [symptomManager]);

  function handleClone(): void {
    addMetric(pastMetric.symptomId, intensity, pastMetric.notes);
  }

  return (
    <Container
      style={{
        opacity: alreadyRecordedToday ? 0.6 : undefined,
      }}
    >
      <Name>{name}</Name>
      <IntensitySelector selectedIntensity={intensity} onSelect={setIntensity} />
      <Button text="Clone" large onClick={handleClone} />
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

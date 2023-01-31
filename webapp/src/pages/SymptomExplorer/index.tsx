import CenteredPage from "../../components/CenteredPage";
import NavBar from "../../components/NavBar";
import { Symptom } from "../../domain/model";
import { SymptomManager } from "../../domain/symptoms";
import Paths from "../../routes";
import BlueprintThemeProvider from "../../style/theme";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

interface Props {
  symptomManager: SymptomManager;
}
function SymptomExplorer({ symptomManager }: Props) {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);

  useEffect(() => {
    const subscription = symptomManager.changes$.subscribe((_) => {
      setSymptoms(symptomManager.getAll());
    });

    setSymptoms(symptomManager.getAll());

    return () => {
      subscription.unsubscribe();
    };
  }, [symptomManager]);

  return (
    <BlueprintThemeProvider>
      <CenteredPage>
        <NavBar />
        <div>SymptomExplorer</div>
        {symptoms.map((symptom) => (
          <OpenSymptomEditor symptom={symptom} />
        ))}
      </CenteredPage>
    </BlueprintThemeProvider>
  );
}

export default SymptomExplorer;

const LinkContainer = styled.div`
  margin: 1rem 0;
`;

function OpenSymptomEditor({ symptom }: { symptom: Symptom }) {
  const path = `${Paths.symptoms}/${symptom.id}`;

  return (
    <LinkContainer>
      <Link to={path}>{symptom.name}</Link>
    </LinkContainer>
  );
}
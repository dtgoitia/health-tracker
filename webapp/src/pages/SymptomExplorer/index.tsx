import { useApp } from "../..";
import AddSymptom from "../../components/AddSymptom";
import CenteredPage from "../../components/CenteredPage";
import NavBar from "../../components/NavBar";
import { Symptom, SymptomName } from "../../lib/domain/model";
import Paths from "../../routes";
import BlueprintThemeProvider from "../../style/theme";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

function SymptomExplorer() {
  const app = useApp();

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);

  useEffect(() => {
    const subscription = app.symptomManager.changes$.subscribe((_) => {
      setSymptoms(app.symptomManager.getAll());
    });

    setSymptoms(app.symptomManager.getAll());

    return () => {
      subscription.unsubscribe();
    };
  }, [app]);

  function handleAddSymptom(name: SymptomName, otherNames: SymptomName[]): void {
    console.log(
      `${SymptomExplorer.name}.handleAddSymptom::adding a new symptom: ${name}`
    );
    app.symptomManager.add({ name, otherNames });
  }

  return (
    <BlueprintThemeProvider>
      <CenteredPage>
        <NavBar />
        <div>SymptomExplorer</div>
        <AddSymptom add={handleAddSymptom} />
        {symptoms.map((symptom) => (
          <OpenSymptomEditor key={`${symptom.id}`} symptom={symptom} />
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

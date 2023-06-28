import CenteredPage from "../../components/CenteredPage";
import { DeleteConfirmationDialog } from "../../components/DeleteConfirmationDialog";
import NavBar from "../../components/NavBar";
import { now } from "../../datetimeUtils";
import { MetricManager } from "../../domain/metrics";
import { Symptom, SymptomId, SymptomName } from "../../domain/model";
import {
  setSymptomName,
  setSymptomOtherNames,
  SymptomManager,
  SYMPTOM_PREFIX,
} from "../../domain/symptoms";
import { notify } from "../../notify";
import Paths from "../../routes";
import BlueprintThemeProvider from "../../style/theme";
import { Button, Label } from "@blueprintjs/core";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const DRAFT_SYMPTOM: Symptom = {
  id: `${SYMPTOM_PREFIX}_DRAFT`,
  name: "",
  otherNames: [],
  lastModified: now(),
};

interface Props {
  metricManager: MetricManager;
  symptomManager: SymptomManager;
}

function SymptomEditor({ symptomManager, metricManager }: Props) {
  const { symptomId } = useParams();
  const navigate = useNavigate();

  const [symptom, setSymptom] = useState<Symptom>(DRAFT_SYMPTOM);

  useEffect(() => {
    function handleSymptomChanges(): void {
      if (symptomId === undefined) {
        return;
      }

      const symptom = symptomManager.get(symptomId);
      if (symptom === undefined) {
        navigate(Paths.symptoms);
        return;
      }

      setSymptom(symptom);
    }

    const subscription = symptomManager.changes$.subscribe(() => {
      handleSymptomChanges();
    });

    handleSymptomChanges();

    return () => subscription.unsubscribe();
  }, [symptomManager, symptomId, navigate]);

  function handleNameChange(event: any): void {
    const name: SymptomName = event.target.value;
    setSymptom(setSymptomName(symptom, name));
  }

  function handleOtherNamesChange(event: any): void {
    const otherNames: SymptomName[] = event.target.value.split(",");
    setSymptom(setSymptomOtherNames(symptom, otherNames));
  }

  function handleSave(): void {
    symptomManager.update({ symptom }).match({
      ok: () => {
        // Show pop up
        notify({
          message: `Symptom "${symptom.name}" successfully saved`,
          intent: "success",
        });
      },
      err: (reason) => {
        notify({
          message: `ERROR: ${reason}`,
          intent: "danger",
        });
        console.error(reason);
      },
    });
  }

  function handleRemoveSymptom(id: SymptomId): void {
    console.log(`${SymptomEditor.name}.handleRemoveSymptom::removing symptom: ${id}`);
    if (metricManager.isSymptomUsedInHistory({ symptomId: id })) {
      alert(`This symptom is used in the history, cannot be removed!`);
      return;
    }

    symptomManager.delete({ id });
  }

  return (
    <BlueprintThemeProvider>
      <CenteredPage>
        <NavBar />
        <p>
          symptom ID:&nbsp;&nbsp;&nbsp;<code>{symptom.id}</code>
        </p>

        <Label>
          name:
          <input
            type="text"
            className={"bp4-input"}
            value={symptom.name}
            placeholder="Name"
            onChange={handleNameChange}
          />
        </Label>

        <Label>
          other names:
          <input
            type="text"
            className={"bp4-input"}
            value={symptom.otherNames.join(",")}
            placeholder="Other names"
            onChange={handleOtherNamesChange}
          />
        </Label>

        <Button intent="success" text="Save" onClick={handleSave} />

        <DeleteConfirmationDialog
          title={`Do you want to delete the ${symptom.id} Symptom?`}
          input={symptom.id}
          onDelete={() => handleRemoveSymptom(symptom.id)}
        />

        <pre>{JSON.stringify(symptom, null, 2)}</pre>
      </CenteredPage>
    </BlueprintThemeProvider>
  );
}

export default SymptomEditor;

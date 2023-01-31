import ReloadPage from "../../ReloadPage";
import { now } from "../../datetimeUtils";
import { MetricManager } from "../../domain/metrics";
import {
  FilterQuery,
  filterSymptoms,
  Intensity,
  Metric,
  MetricId,
  Notes,
  Symptom,
  SymptomId,
  SymptomName,
} from "../../domain/model";
import { SymptomManager } from "../../domain/symptoms";
import storage from "../../localStorage";
import BlueprintThemeProvider from "../../style/theme";
import AddMetric from "./AddMetric";
import AddSymptom from "./AddSymptom";
import DownloadCsv from "./DownloadCsv";
import { DownloadJson } from "./DownloadJson";
import HistoryView from "./HistoryView";
import InventoryView from "./Inventory";
import SearchBox from "./SearchBox";
import { useEffect, useState } from "react";
import styled from "styled-components";

const Centered = styled.div`
  margin: 0 auto;
  padding: 0 1rem;
  max-width: 800px;
`;

interface Props {
  symptomManager: SymptomManager;
  metricManager: MetricManager;
}
function HistoryPage({ symptomManager, metricManager }: Props) {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [selected, setSelected] = useState<SymptomId | undefined>();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [userIsSearching, setUserIsSearching] = useState(false);

  useEffect(() => {
    const symptomSubscription = symptomManager.changes$.subscribe((_) => {
      setSymptoms(symptomManager.getAll());
    });
    const metricSubscription = metricManager.changes$.subscribe((_) => {
      setMetrics(metricManager.getAll());
    });

    setSymptoms(symptomManager.getAll());
    setMetrics(metricManager.getAll());

    return () => {
      symptomSubscription.unsubscribe();
      metricSubscription.unsubscribe();
    };
  }, [symptomManager, metricManager]);

  const [filterQuery, setFilterQuery] = useState<FilterQuery>("");
  storage.symptoms.set(symptoms);

  function handleAddSymptom(name: SymptomName, otherNames: SymptomName[]): void {
    console.log(`${HistoryPage.name}.handleAddSymptom::adding a new symptom: ${name}`);
    symptomManager.add({ name, otherNames });
  }

  function handleRemoveSymptom(id: SymptomId): void {
    console.log(`${HistoryPage.name}.handleRemoveSymptom::removing symptom: ${id}`);
    if (metricManager.isSymptomUsedInHistory({ symptomId: id })) {
      alert(`This symptom is used in the history, cannot be removed!`);
      return;
    }

    symptomManager.delete({ id });
  }

  function handleAddMetric(id: SymptomId, intensity: Intensity, notes: Notes): void {
    console.log(
      `${HistoryPage.name}.handleAddMetric::adding a new metric: symptom ID ${id}`
    );
    metricManager.add({ symptomId: id, intensity, notes, date: now() });
    // setSelected(undefined);
  }

  const handleSelectSymptom = (id: SymptomId) => {
    setSelected(id);
  };

  function handleMetricUpdate(updated: Metric): void {
    metricManager.update({ metric: updated });
  }

  function handleMetricDeletion(id: MetricId): void {
    metricManager.delete({ id });
  }

  function handleMetricDuplication(ids: Set<MetricId>): void {
    metricManager.duplicate({ ids });
  }

  const clearSearch = () => {
    setFilterQuery("");
    setUserIsSearching(false);
  };

  return (
    <BlueprintThemeProvider>
      <Centered>
        <SearchBox
          query={filterQuery}
          onChange={setFilterQuery}
          clearSearch={clearSearch}
          onFocus={() => setUserIsSearching(true)}
        />
        <InventoryView
          symptoms={filterSymptoms(symptoms, filterQuery)}
          removeSymptom={handleRemoveSymptom}
          selectSymptom={handleSelectSymptom}
          collapse={!userIsSearching}
        />
        <AddMetric
          symptoms={symptoms}
          selectedSymptomId={selected}
          record={handleAddMetric}
        />
        <HistoryView
          history={metrics}
          symptomManager={symptomManager}
          updateMetric={handleMetricUpdate}
          deleteMetric={handleMetricDeletion}
          duplicateMetrics={handleMetricDuplication}
        />
        <AddSymptom add={handleAddSymptom} />
        <DownloadCsv symptoms={symptoms} history={metrics} />
        <DownloadJson symptoms={symptoms} history={metrics} />
        <ReloadPage />
      </Centered>
    </BlueprintThemeProvider>
  );
}

export default HistoryPage;

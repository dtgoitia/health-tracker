import ReloadPage from "../../ReloadPage";
import AddSymptom from "../../components/AddSymptom";
import CenteredPage from "../../components/CenteredPage";
import NavBar from "../../components/NavBar";
import { now } from "../../datetimeUtils";
import { HealthTracker } from "../../lib/app/app";
import { filterMetrics } from "../../lib/app/metrics";
import { filterSymptoms } from "../../lib/app/symptoms";
import {
  FilterQuery,
  Intensity,
  Metric,
  MetricId,
  Notes,
  Symptom,
  SymptomId,
  SymptomName,
} from "../../lib/domain/model";
import BlueprintThemeProvider from "../../style/theme";
import AddMetric from "./AddMetric";
import DownloadCsv from "./DownloadCsv";
import { DownloadJson } from "./DownloadJson";
import HistoryView from "./HistoryView";
import InventoryView from "./Inventory";
import SearchBox from "./SearchBox";
import { useEffect, useState } from "react";

interface Props {
  app: HealthTracker;
}

function HistoryPage({ app }: Props) {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [selected, setSelected] = useState<SymptomId | undefined>();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [userIsSearching, setUserIsSearching] = useState(false);

  useEffect(() => {
    const symptomSubscription = app.symptomManager.changes$.subscribe((_) => {
      setSymptoms(app.symptomManager.getAll());
    });
    const metricSubscription = app.metricManager.changes$.subscribe((_) => {
      setMetrics(app.metricManager.getAll());
    });

    setSymptoms(app.symptomManager.getAll());
    setMetrics(app.metricManager.getAll());

    return () => {
      symptomSubscription.unsubscribe();
      metricSubscription.unsubscribe();
    };
  }, [app]);

  const [filterQuery, setFilterQuery] = useState<FilterQuery>("");

  function handleAddSymptom(name: SymptomName, otherNames: SymptomName[]): void {
    console.log(
      `${HistoryPage.name}.${handleAddSymptom.name}::adding a new symptom: ${name}`
    );
    app.symptomManager.add({ name, otherNames });
  }

  function handleAddMetric(id: SymptomId, intensity: Intensity, notes: Notes): void {
    console.log(
      `${HistoryPage.name}.${handleAddMetric}::adding a new metric: symptom ID ${id}`
    );
    app.metricManager.add({ symptomId: id, intensity, notes, date: now() });
  }

  const handleSelectSymptom = (id: SymptomId) => {
    setSelected(id);
  };

  function handleMetricUpdate(updated: Metric): void {
    app.metricManager.update({ metric: updated });
  }

  function handleMetricDeletion(id: MetricId): void {
    app.metricManager.delete({ id });
  }

  function handleMetricDuplication(ids: Set<MetricId>): void {
    app.metricManager.duplicate({ ids });
  }

  const clearSearch = () => {
    setFilterQuery("");
    setUserIsSearching(false);
  };

  const filteredSymptoms = filterSymptoms(symptoms, filterQuery);

  return (
    <BlueprintThemeProvider>
      <CenteredPage>
        <NavBar app={app} />

        <SearchBox
          query={filterQuery}
          onChange={setFilterQuery}
          clearSearch={clearSearch}
          onFocus={() => setUserIsSearching(true)}
        />
        <InventoryView
          symptoms={filteredSymptoms}
          selectSymptom={handleSelectSymptom}
          collapse={!userIsSearching}
        />
        <AddMetric
          symptoms={symptoms}
          selectedSymptomId={selected}
          record={handleAddMetric}
        />

        <HistoryView
          history={filterMetrics({ symptomsToShow: filteredSymptoms, metrics })}
          symptomManager={app.symptomManager}
          updateMetric={handleMetricUpdate}
          deleteMetric={handleMetricDeletion}
          duplicateMetrics={handleMetricDuplication}
        />
        <AddSymptom add={handleAddSymptom} />
        <DownloadCsv symptoms={symptoms} history={metrics} />
        <DownloadJson symptoms={symptoms} history={metrics} />
        <ReloadPage />
      </CenteredPage>
    </BlueprintThemeProvider>
  );
}

export default HistoryPage;

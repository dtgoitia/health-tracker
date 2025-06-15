import ReloadPage from "../../ReloadPage";
import CenteredPage from "../../components/CenteredPage";
import NavBar from "../../components/NavBar";
import { nDaysAgo, now } from "../../datetimeUtils";
import { HealthTracker } from "../../lib/app/app";
import {
  FilterQuery,
  Intensity,
  Metric,
  MetricId,
  Notes,
  Symptom,
  SymptomId,
} from "../../lib/domain/model";
import BlueprintThemeProvider from "../../style/theme";
import AddMetric from "../History/AddMetric";
import HistoryView from "../History/HistoryView";
import InventoryView from "../History/Inventory";
import SearchBox from "../History/SearchBox";
import DailyReminder from "./DailyReminder";
import { useEffect, useState } from "react";

interface Props {
  app: HealthTracker;
}

export function RecordMetricPage({ app }: Props) {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [selected, setSelected] = useState<SymptomId | undefined>();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [userIsSearching, setUserIsSearching] = useState(false);

  useEffect(() => {
    const symptomSubscription = app.symptomManager.changes$.subscribe((_) => {
      setSymptoms(app.symptomManager.getAll());
    });
    const metricSubscription = app.metricManager.changes$.subscribe((_) => {
      const fullHistory = app.metricManager.getAll();
      const todayOrLater = keepRecentMetrics(fullHistory);
      setMetrics(todayOrLater);
    });

    setSymptoms(app.symptomManager.getAll());

    const fullHistory = app.metricManager.getAll();
    const todayOrLater = keepRecentMetrics(fullHistory);
    setMetrics(todayOrLater);

    return () => {
      symptomSubscription.unsubscribe();
      metricSubscription.unsubscribe();
    };
  }, [app]);

  const [filterQuery, setFilterQuery] = useState<FilterQuery>("");

  function handleAddMetric(id: SymptomId, intensity: Intensity, notes: Notes): void {
    console.log(
      `${RecordMetricPage.name}.${handleAddMetric.name}::adding a new metric: symptom ID ${id}`
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

  return (
    <BlueprintThemeProvider>
      <CenteredPage>
        <NavBar app={app} />

        <DailyReminder
          symptomManager={app.symptomManager}
          metricManager={app.metricManager}
        />

        <SearchBox
          query={filterQuery}
          onChange={setFilterQuery}
          clearSearch={clearSearch}
          onFocus={() => setUserIsSearching(true)}
        />
        <InventoryView
          symptoms={app.symptomManager.searchByPrefix(filterQuery)}
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
          symptomManager={app.symptomManager}
          updateMetric={handleMetricUpdate}
          deleteMetric={handleMetricDeletion}
          duplicateMetrics={handleMetricDuplication}
        />
        <ReloadPage />
      </CenteredPage>
    </BlueprintThemeProvider>
  );
}

function keepRecentMetrics(all: Metric[]): Metric[] {
  const t = nDaysAgo({ n: 2 }).getTime();

  return all.filter((record) => t < record.date.getTime());
}

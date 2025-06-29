import { useApp } from "../..";
import CenteredPage from "../../components/CenteredPage";
import NavBar from "../../components/NavBar";
import { Metric, MetricId } from "../../lib/domain/model";
import Paths from "../../routes";
import BlueprintThemeProvider from "../../style/theme";
import { MetricEditor } from "./MetricEditor";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Props {}

export function MetricPage({}: Props) {
  const app = useApp();

  // The app router should prevent you from having an undefined URL
  // parameter here
  const { metricId: maybeMetricId } = useParams();
  const metricId = maybeMetricId as MetricId;

  const navigate = useNavigate();

  const [metric, setMetric] = useState<Metric | undefined>();
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);

  useEffect(() => {
    function _rerender(): void {
      const metric = app.metricManager.get(metricId);
      setMetric(metric);
    }

    const subscription = app.metricManager.changes$.subscribe((change) => {
      if (change.kind === "MetricManagerInitialized") {
        setDataLoaded(true);
      }
      _rerender();
    });

    _rerender();

    return () => {
      subscription.unsubscribe();
    };
  }, [app, metricId, navigate]);

  if (metric === undefined) {
    if (dataLoaded) {
      navigate(Paths.metrics);
    } else {
      return (
        <BlueprintThemeProvider>
          <CenteredPage>
            <NavBar />
            Loading metric data...
          </CenteredPage>
        </BlueprintThemeProvider>
      );
    }
  }

  function handleMetricUpdate(metric: Metric): void {
    app.metricManager.update({ metric });
  }

  function handleMetricDelete(id: MetricId): void {
    app.metricManager.delete({ id });
  }

  return (
    <BlueprintThemeProvider>
      <CenteredPage>
        <NavBar />
        <MetricEditor
          metric={metric as Metric}
          onUpdate={handleMetricUpdate}
          onDelete={handleMetricDelete}
        />
      </CenteredPage>
    </BlueprintThemeProvider>
  );
}

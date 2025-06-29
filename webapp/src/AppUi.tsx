import { useApp } from ".";
import HistoryPage from "./pages/History";
import PageNotFound from "./pages/PageNotFound";
import { RecordMetricPage } from "./pages/RecordMetric";
import SettingsPage from "./pages/Settings";
import SymptomEditor from "./pages/SymptomEditor";
import SymptomExplorer from "./pages/SymptomExplorer";
import Paths from "./routes";
import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";

function AppUi() {
  const app = useApp();

  useEffect(() => {
    app.initialize();
  }, [app]);

  return (
    <Routes>
      <Route path={Paths.root} element={<RecordMetricPage />} />
      <Route path={Paths.metrics} element={<HistoryPage />} />
      <Route path={Paths.symptoms} element={<SymptomExplorer />} />
      <Route path={Paths.symptomsEditor} element={<SymptomEditor />} />
      <Route path={Paths.settings} element={<SettingsPage />} />
      <Route path={Paths.notFound} element={<PageNotFound />} />
    </Routes>
  );
}

export default AppUi;

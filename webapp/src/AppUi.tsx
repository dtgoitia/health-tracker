import { HealthTracker } from "./lib/app/app";
import HistoryPage from "./pages/History";
import PageNotFound from "./pages/PageNotFound";
import SettingsPage from "./pages/Settings";
import SymptomEditor from "./pages/SymptomEditor";
import SymptomExplorer from "./pages/SymptomExplorer";
import Paths from "./routes";
import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";

interface Props {
  app: HealthTracker;
}

function AppUi({ app }: Props) {
  useEffect(() => {
    app.initialize();
  }, [app]);

  return (
    <Routes>
      <Route path={Paths.root} element={<HistoryPage app={app} />} />
      <Route path={Paths.symptoms} element={<SymptomExplorer app={app} />} />
      <Route path={Paths.symptomsEditor} element={<SymptomEditor app={app} />} />
      <Route path={Paths.settings} element={<SettingsPage app={app} />} />
      <Route path={Paths.notFound} element={<PageNotFound />} />
    </Routes>
  );
}

export default AppUi;

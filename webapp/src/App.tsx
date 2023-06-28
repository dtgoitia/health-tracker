import "./App.css";
import { initialize } from "./domain/initialize";
import HistoryPage from "./pages/History";
import PageNotFound from "./pages/PageNotFound";
import SymptomEditor from "./pages/SymptomEditor";
import SymptomExplorer from "./pages/SymptomExplorer";
import Paths from "./routes";
import { Route, Routes } from "react-router-dom";

function App() {
  const { symptomManager, metricManager } = initialize();

  return (
    <Routes>
      <Route
        path={Paths.root}
        element={
          <HistoryPage symptomManager={symptomManager} metricManager={metricManager} />
        }
      />
      <Route
        path={Paths.symptoms}
        element={<SymptomExplorer symptomManager={symptomManager} />}
      />
      <Route
        path={Paths.symptomsEditor}
        element={
          <SymptomEditor symptomManager={symptomManager} metricManager={metricManager} />
        }
      />
      <Route path={Paths.notFound} element={<PageNotFound />} />
    </Routes>
  );
}

export default App;

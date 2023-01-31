import "./App.css";
import { initialize } from "./domain/initialize";
import HistoryPage from "./pages/History";

function App() {
  const { symptomManager, metricManager } = initialize();

  // TODO: add routes
  return <HistoryPage symptomManager={symptomManager} metricManager={metricManager} />;
}

export default App;

import AddMetric from "./AddMetric";
import AddSymptom from "./AddSymptom";
import "./App.css";
import DownloadCsv from "./DownloadCsv";
import ReloadPage from "./ReloadPage";
import SearchBox from "./SearchBox";
import HistoryView from "./Views/History";
import InventoryView from "./Views/Inventory";
import {
  addSymptom,
  filterSymptoms,
  FilterQuery,
  getSymptomsFromStorage,
  SymptomId,
  SymptomName,
  removeSymptom,
  getHistoryFromStorage,
  Intensity,
  addMetric,
  isSymptomUsedInHistory,
  Notes,
  Metric,
  sortHistory,
} from "./domain";
import storage from "./localStorage";
import BlueprintThemeProvider from "./style/theme";
import { useState } from "react";
import styled from "styled-components";

const Centered = styled.div`
  margin: 0 auto;
  padding: 0 1rem;
  max-width: 800px;
`;

function App() {
  const [symptoms, setSymptoms] = useState(getSymptomsFromStorage());
  const [selected, setSelected] = useState<SymptomId | undefined>(undefined);
  const [history, _setHistory] = useState(getHistoryFromStorage());
  const [userIsSearching, setUserIsSearching] = useState(false);
  function setHistory(history: Metric[]): void {
    _setHistory(sortHistory(history));
  }
  const [filterQuery, setFilterQuery] = useState<FilterQuery>("");
  storage.symptoms.set(symptoms);

  const handleAddSymptom = (name: SymptomName, otherNames: SymptomName[]) => {
    console.log(`Adding a new symptom: ${name}`);
    setSymptoms(addSymptom(symptoms, name, otherNames));
  };

  const handleRemoveSymptom = (id: SymptomId) => {
    console.log(`Removing symptom (ID: ${id})`);
    if (isSymptomUsedInHistory(id, history)) {
      alert(`This symptom is used in the history, cannot be removed!`);
      return;
    }
    setSymptoms(removeSymptom(symptoms, id));
  };

  const handleAddMetric = (
    id: SymptomId,
    intensity: Intensity,
    notes: Notes
  ) => {
    console.log(`Adding a new metric: id=${id}`);
    const updatedHistory = addMetric(history, id, intensity, notes);
    setHistory(updatedHistory);
    storage.history.set(updatedHistory);
    setSelected(undefined);
  };

  const handleSelectSymptom = (id: SymptomId) => {
    setSelected(id);
  };

  function handleHistoryChange(history: Metric[]): void {
    setHistory(history);
    storage.history.set(history);
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
          history={history}
          activities={symptoms}
          onHistoryChange={handleHistoryChange}
        />
        <AddSymptom add={handleAddSymptom} />
        <DownloadCsv activities={symptoms} history={history} />
        <ReloadPage />
      </Centered>
    </BlueprintThemeProvider>
  );
}

export default App;

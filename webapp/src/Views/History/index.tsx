import {
  Symptom,
  Metric,
  MetricId,
  deleteMetric,
  groupByDay,
  indexSymptoms,
  updateHistory,
  duplicateSelection,
} from "../../domain";
import EditableRow from "./EditableRow";
import Row from "./Row";
import { Button, Switch } from "@blueprintjs/core";
import "@blueprintjs/datetime/lib/css/blueprint-datetime.css";
import { useState } from "react";
import styled from "styled-components";

const DayHeader = styled.div`
  font-size: 1rem;
  border-bottom: 1px rgba(255, 255, 255, 0.3) solid;
  margin-top: 0.8rem;
  margin-bottom: 0.3rem;
  padding-bottom: 0.3rem;
`;

const Container = styled.div`
  padding: 1rem 0;
`;

interface HistoryViewProps {
  activities: Symptom[];
  history: Metric[];
  onHistoryChange: (history: Metric[]) => void;
}
function HistoryView({
  history,
  activities,
  onHistoryChange,
}: HistoryViewProps) {
  const [isEditModeOn, setIsEditModeOn] = useState<boolean>(false);
  const [selection, setSelected] = useState<Set<MetricId>>(new Set([]));

  if (history.length === 0) {
    // Problem: if the edit mode is ON and all the transactions are deleted, the switch
    // will is not visible to exit the edit mode, and when a new metric is added, it
    // can be mistakenly deleted.
    //
    // Solution: if the history is empty, just switch off the edit mode.
    if (isEditModeOn) setIsEditModeOn(false);

    return <Container>{`History is empty :)`}</Container>;
  }

  const symptomIndex = indexSymptoms(activities);

  const metricsByDay = groupByDay(history);

  function deleteRow(id: MetricId): void {
    const newHistory = deleteMetric(history, id);
    onHistoryChange(newHistory);
  }

  function updateRow(updated: Metric): void {
    const newHistory = updateHistory(history, updated);
    onHistoryChange(newHistory);
  }

  function toggleEditMode(): void {
    setIsEditModeOn(!isEditModeOn);
  }

  function unselectAll(): void {
    setSelected(new Set<MetricId>([]));
  }

  function select(id: MetricId): Set<MetricId> {
    return new Set([...selection, id]);
  }

  function unselect(id: MetricId): Set<MetricId> {
    return new Set([...selection].filter((selectedId) => selectedId !== id));
  }

  function handleToggleSelect(id: MetricId): void {
    const newSelection = selection.has(id) ? unselect(id) : select(id);
    setSelected(newSelection);
  }

  function handleDuplicate(): void {
    const newHistory = duplicateSelection(history, selection);
    unselectAll();
    onHistoryChange(newHistory);
  }

  return (
    <Container>
      <Switch
        label={"edit mode"}
        checked={isEditModeOn}
        onClick={toggleEditMode}
        readOnly
      />
      {isEditModeOn ? (
        <Button
          icon="duplicate"
          text="duplicate"
          minimal={true}
          onClick={handleDuplicate}
        />
      ) : null}
      {metricsByDay.map(([day, dayActivities], i) => {
        return (
          <div key={i}>
            <DayHeader>{day}</DayHeader>
            {dayActivities.map((metric, j) => {
              const symptom = symptomIndex.get(metric.symptomId) as Symptom;
              const id = metric.id;
              if (!symptom) {
                const errorMessage = `Metric ${metric.symptomId} not found`;
                console.warn(errorMessage);
                return <div key={j}>{errorMessage}</div>;
              }

              if (isEditModeOn) {
                return (
                  <EditableRow
                    key={j}
                    symptom={symptom}
                    metric={metric}
                    selected={selection.has(id)}
                    onDelete={() => deleteRow(metric.id)}
                    onChange={updateRow}
                    onToggleSelect={() => handleToggleSelect(id)}
                  />
                );
              }
              return <Row key={j} symptom={symptom} metric={metric} />;
            })}
          </div>
        );
      })}
    </Container>
  );
}

export default HistoryView;

import {
  Symptom,
  Metric,
  MetricId,
  deleteMetric,
  groupByDay,
  indexSymptoms,
  updateHistory,
} from "../../domain";
import EditableRow from "./EditableRow";
import Row from "./Row";
import { Switch } from "@blueprintjs/core";
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

  return (
    <Container>
      <Switch
        label={"edit mode"}
        checked={isEditModeOn}
        onClick={toggleEditMode}
        readOnly
      />
      {metricsByDay.map(([day, dayActivities], i) => {
        return (
          <div key={i}>
            <DayHeader>{day}</DayHeader>
            {dayActivities.map((metric, j) => {
              const symptom = symptomIndex.get(
                metric.symptomId
              ) as Symptom;
              if (isEditModeOn) {
                return (
                  <EditableRow
                    key={j}
                    symptom={symptom}
                    metric={metric}
                    onDelete={() => deleteRow(metric.id)}
                    onChange={updateRow}
                  />
                );
              }
              return (
                <Row
                  key={j}
                  symptom={symptom}
                  metric={metric}
                />
              );
            })}
          </div>
        );
      })}
    </Container>
  );
}

export default HistoryView;

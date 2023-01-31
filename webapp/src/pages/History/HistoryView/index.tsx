import { Symptom, MetricId, groupByDay, Metric } from "../../../domain/model";
import { SymptomManager } from "../../../domain/symptoms";
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
  history: Metric[];
  symptomManager: SymptomManager;
  updateMetric: (update: Metric) => void;
  deleteMetric: (id: MetricId) => void;
  duplicateMetrics: (ids: Set<MetricId>) => void;
}
function HistoryView({
  history,
  symptomManager,
  updateMetric,
  deleteMetric,
  duplicateMetrics,
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

  const metricsByDay = groupByDay(history);

  function toggleEditMode(): void {
    setIsEditModeOn(!isEditModeOn);
  }

  function unselectAll(): void {
    setSelected(new Set<MetricId>([]));
  }

  function select(id: MetricId): Set<MetricId> {
    // recreate the set to avoid mutations
    return new Set([...selection, id]);
  }

  function unselect(id: MetricId): Set<MetricId> {
    // recreate the set to avoid mutations
    return new Set([...selection].filter((selectedId) => selectedId !== id));
  }

  function handleToggleSelect(id: MetricId): void {
    const newSelection = selection.has(id) ? unselect(id) : select(id);
    setSelected(newSelection);
  }

  function handleDuplicate(): void {
    duplicateMetrics(selection);
    unselectAll();
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
      {metricsByDay.map(([day, dayActivities]) => {
        return (
          <div key={day}>
            <DayHeader>{day}</DayHeader>
            {dayActivities.map((metric) => {
              const { id, symptomId } = metric;
              const symptom = symptomManager.get(symptomId) as Symptom;
              if (symptom === undefined) {
                const errorMessage = `Metric ${id} points a Symptom ${symptomId} that does not exist`;
                return <div key={id}>{errorMessage}</div>;
              }

              if (isEditModeOn) {
                return (
                  <EditableRow
                    key={id}
                    symptom={symptom}
                    metric={metric}
                    selected={selection.has(id)}
                    onDelete={() => deleteMetric(metric.id)}
                    onChange={updateMetric}
                    onToggleSelect={() => handleToggleSelect(id)}
                  />
                );
              }
              return <Row key={id} symptom={symptom} metric={metric} />;
            })}
          </div>
        );
      })}
    </Container>
  );
}

export default HistoryView;

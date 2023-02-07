import { now } from "../../datetimeUtils";
import { MetricDeleted, MetricManager, MetricUpdated } from "../../domain/metrics";
import { Intensity, Metric, Symptom, SymptomId } from "../../domain/model";
import { sortSymptomsAlphabetically, SymptomManager } from "../../domain/symptoms";
import SymptomSuggestion from "./SymptomSuggestion";
import { Button, Card, Collapse } from "@blueprintjs/core";
import { useEffect, useState } from "react";
import styled from "styled-components";

interface Props {
  symptomManager: SymptomManager;
  metricManager: MetricManager;
}
function DailyReminder({ symptomManager, metricManager }: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [lastMetrics, setLastMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    const subscription = metricManager.changes$.subscribe((change) => {
      if (change instanceof MetricUpdated || change instanceof MetricDeleted) {
        setLastMetrics(metricManager.getMetricsOfLastNDays({ n: 2 }));
      }
    });

    setLastMetrics(metricManager.getMetricsOfLastNDays({ n: 2 }));

    return () => {
      subscription.unsubscribe();
    };
  }, [metricManager]);

  // TODO: sort them alphabetically - the chronological order makes no sense
  const symptomsToSuggest: Symptom[] = getSymptomsFromMetrics({
    symptomManager,
    metrics: lastMetrics,
  });

  function handleSuggestionClick(id: SymptomId, intensity: Intensity): void {
    metricManager.add({ symptomId: id, intensity, date: now(), notes: "" });
  }

  return (
    <Container>
      {isOpen === false && (
        <Button
          icon="add"
          intent="none"
          text="Review yesterday symptoms"
          onClick={() => setIsOpen(true)}
          fill
          large
        />
      )}
      <Collapse isOpen={isOpen}>
        <Card>
          {symptomsToSuggest.length > 0 ? (
            symptomsToSuggest.map((symptom) => (
              <SymptomSuggestion
                key={symptom.id}
                symptom={symptom}
                onSuggestionClick={handleSuggestionClick}
              />
            ))
          ) : (
            <p>No metrics yesterday, no suggestions today :)</p>
          )}
        </Card>
      </Collapse>
    </Container>
  );
}

export default DailyReminder;

const Container = styled.div``;

/**
 * Gather symptom IDs preserving the order of yesterday metrics and remove duplicates
 */
function getSymptomsFromMetrics({
  symptomManager,
  metrics,
}: {
  symptomManager: SymptomManager;
  metrics: Metric[];
}): Symptom[] {
  const visited = new Set<SymptomId>();
  const symptomsToSuggest: Symptom[] = [];

  for (const metric of metrics) {
    const { symptomId } = metric;
    if (visited.has(symptomId)) continue;
    visited.add(symptomId);

    const symptom = symptomManager.get(symptomId) as Symptom;
    if (symptom === undefined) continue;
    symptomsToSuggest.push(symptom);
  }

  const sortedSymptoms = symptomsToSuggest.sort(sortSymptomsAlphabetically);

  return sortedSymptoms;
}

import { now } from "../../datetimeUtils";
import { MetricDeleted, MetricManager, MetricUpdated } from "../../domain/metrics";
import { Intensity, Metric, Symptom, SymptomId } from "../../domain/model";
import { SymptomManager } from "../../domain/symptoms";
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
  const [yesterdayMetrics, setYesterdayMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    const subscription = metricManager.changes$.subscribe((change) => {
      if (change instanceof MetricUpdated || change instanceof MetricDeleted) {
        setYesterdayMetrics(metricManager.getYesterdayMetrics());
      }
    });

    setYesterdayMetrics(metricManager.getYesterdayMetrics());

    return () => {
      subscription.unsubscribe();
    };
  }, [metricManager]);

  const symptomsToSuggest: Symptom[] = getSymptomsToSuggest({
    symptomManager,
    yesterdayMetrics,
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
function getSymptomsToSuggest({
  symptomManager,
  yesterdayMetrics,
}: {
  symptomManager: SymptomManager;
  yesterdayMetrics: Metric[];
}): Symptom[] {
  const visited = new Set<SymptomId>();
  const symptomsToSuggest: Symptom[] = [];

  for (const metric of yesterdayMetrics) {
    const { symptomId } = metric;
    if (visited.has(symptomId)) continue;
    visited.add(symptomId);

    const symptom = symptomManager.get(symptomId) as Symptom;
    if (symptom === undefined) continue;
    symptomsToSuggest.push(symptom);
  }

  return symptomsToSuggest;
}

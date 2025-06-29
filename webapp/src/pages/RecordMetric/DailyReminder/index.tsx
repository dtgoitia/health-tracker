import { isSameDay, now } from "../../../lib/datetimeUtils";
import { unreachable } from "../../../lib/devex";
import { MetricManager } from "../../../lib/domain/metrics";
import { Intensity, Metric, SymptomId } from "../../../lib/domain/model";
import { SymptomManager } from "../../../lib/domain/symptoms";
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
    const subscription = metricManager.changes$.subscribe(() => {
      setLastMetrics(metricManager.getMetricsOfLastNDays({ n: 2 }));
    });

    setLastMetrics(metricManager.getMetricsOfLastNDays({ n: 2 }));

    return () => {
      subscription.unsubscribe();
    };
  }, [metricManager]);

  function handleSuggestionClick(id: SymptomId, intensity: Intensity): void {
    metricManager.add({ symptomId: id, intensity, date: now(), notes: "" });
  }

  const pastMetrics = enrichAndSquashMetrics(lastMetrics, now());

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
          {pastMetrics.length > 0 ? (
            /*
              in past | in today | scenario                     | action
              --------|----------|------------------------------|-------------
              true    | false    | do you still have it?        | show normal
              true    | true     | you still have it            | fade it out
              false   | true     | you got something new today  | do now show
            */
            pastMetrics
              .filter((pastMetric) => pastMetric.recordedInThePast)
              .map((pastMetric) => (
                <SymptomSuggestion
                  key={`${pastMetric.symptomId}-${pastMetric.recordedToday}`}
                  pastMetric={pastMetric}
                  onSuggestionClick={handleSuggestionClick}
                  symptomManager={symptomManager}
                  alreadyRecordedToday={pastMetric.recordedToday}
                />
              ))
          ) : (
            <p>No metrics yesterday, no suggestions today :)</p>
          )}
        </Card>
        <Button
          icon="cross"
          intent="none"
          text="Close"
          onClick={() => setIsOpen(false)}
          fill
          large
        />
      </Collapse>
    </Container>
  );
}

export default DailyReminder;

const Container = styled.div``;

interface EnrichedMetric extends Metric {
  recordedInThePast: boolean;
  recordedToday: boolean;
}

/**
 * Keeps only the latest metric for each symptom, and if a symptom has multiple
 * records, specify if the symptom appears in today or in the past.
 * Returns metrics sorted in reverse chronological order.
 */
export function enrichAndSquashMetrics(
  metrics: Metric[], // metrics of the last n-days
  now: Date
): EnrichedMetric[] {
  const result: EnrichedMetric[] = [];
  const seenSymptoms: Set<SymptomId> = new Set();

  // position of a displayed metric in the `displayed` array
  type MetricIndexInResult = number;
  // map to find the index of displayed metrics by symptom in the `displayed` array
  const metricIndexPerSymptom = new Map<SymptomId, MetricIndexInResult>();

  // traverse past metrics in reverse chronological order
  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    const symptom = metric.symptomId;

    const isInResult = seenSymptoms.has(symptom);

    const belongsToToday = isSameDay({ a: metric.date, b: now });

    const newSymptom = isInResult === false;

    if (newSymptom) {
      // This is the first time we see this symptom among metrics. Note that the
      // metric could be in today or in the past.
      const enrichedMetric: EnrichedMetric = {
        ...metric,
        recordedToday: belongsToToday,
        recordedInThePast: belongsToToday === false,
      };
      result.push(enrichedMetric);
      metricIndexPerSymptom.set(symptom, result.length - 1);
    } else {
      const index = metricIndexPerSymptom.get(symptom);
      if (index === undefined) throw unreachable();
      const displayedMetric = result[index];

      const updated: EnrichedMetric = { ...displayedMetric };
      if (belongsToToday) {
        updated.recordedToday = true;
      } else {
        updated.recordedInThePast = true;
      }
      result[index] = updated;
    }

    seenSymptoms.add(symptom);
  }

  return result;
}

import { Symptom, Metric, indexSymptoms } from "./domain";
import { Button } from "@blueprintjs/core";
import styled from "styled-components";

function formatDate(date: Date): string {
  const isoUtc = date.toISOString();
  const noMilliseconds = isoUtc.split(".")[0];
  const [day] = noMilliseconds.split("T");
  return day;
}

function buildCsv(symptoms: Symptom[], history: Metric[]): Blob {
  const symptomIndex = indexSymptoms(symptoms);

  const headers = ["date", "symptom", "intensity"];

  function metricToRow(metric: Metric): string {
    const symptomId = metric.symptomId;
    const symptom = symptomIndex.get(symptomId) as Symptom;
    if (symptom === undefined) {
      // TODO: push these errors to a central service
      // throw new Error(`Could not find any symptom with ID=${symptomId}`);
    }

    const columns: (string | number)[] = [
      formatDate(metric.date),
      symptom ? symptom.name : `symptomId=${symptomId} not found`,
      metric.intensity,
    ];
    const row = columns.join(",");
    return row;
  }
  const rows = history.map(metricToRow);

  const csvLines = [headers, ...rows];

  const csvString: string = csvLines.join("\n");

  const csv = new Blob([csvString], { type: "text/csv" });
  return csv;
}

const Container = styled.div`
  padding: 1rem 0;
`;

function downloadCsv(blob: Blob, filename: string): void {
  const fileUrl = URL.createObjectURL(blob);
  const xhr = new XMLHttpRequest();
  xhr.open("GET", fileUrl, true);
  xhr.responseType = "blob";
  xhr.onload = function (e) {
    if (this.status === 200) {
      const responseWithDesiredBlob = this.response;
      const anchor = document.createElement("a");
      anchor.href = window.URL.createObjectURL(responseWithDesiredBlob);
      anchor.download = filename;
      anchor.click();
    } else {
      const error = [
        `Status 200 expected but got ${this.status} instead. No idea what happened`,
        `here:\n`,
        `\n`,
        `blob=${blob.text()}\n`,
        `\n`,
        `filename=${filename}\n`,
        `\n`,
        `fileUrl=${fileUrl}\n`,
        `\n`,
      ].join("");
      throw new Error(error);
    }
  };
  xhr.send();
}

function shareApiNotAvailable(): boolean {
  return navigator.share === undefined;
}

interface DownloadCsvProps {
  symptoms: Symptom[];
  history: Metric[];
}
function DownloadCsv({ symptoms, history }: DownloadCsvProps) {
  const fileName = "health-tracker__activities.csv";
  const shareApiAvailable = shareApiNotAvailable() === false;

  function download(): void {
    const blob = buildCsv(symptoms, history);
    downloadCsv(blob, fileName);
  }

  function share(): void {
    const blob = buildCsv(symptoms, history);
    const file = new File([blob], fileName, { type: "text/csv" });
    if (shareApiNotAvailable()) {
      alert("Your device is not compatible with the Web Share API, sorry :)");
      return;
    }

    const dataToShare: ShareData = {
      title: "health-tracker CSV",
      files: [file],
    };

    const canShare = navigator.canShare(dataToShare);
    if (!canShare) {
      alert("You cannot share the CSV for some reason, sorry :)");
      return;
    }

    navigator
      .share(dataToShare)
      .then(() => alert("all good"))
      .catch((error) => {
        alert(error);
      });
  }

  return (
    <Container>
      <Button intent="success" text="Download CSV" onClick={() => download()} />
      <Button
        intent="success"
        text="Share CSV"
        onClick={() => share()}
        disabled={shareApiAvailable === false}
      />
    </Container>
  );
}

export default DownloadCsv;

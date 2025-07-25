import { now } from "../../lib/datetimeUtils";
import { Metric, Symptom } from "../../lib/domain/model";
import { Button } from "@blueprintjs/core";
import { useEffect, useState } from "react";
import styled from "styled-components";

// Using `application/json` does not allow to share the file easily on the phone but
// `text/plain` provides the desired behaviour
const JSON_MIME_TYPE = "text/plain";

const Container = styled.div`
  padding: 1rem 0;
`;

interface Props {
  symptoms: Symptom[];
  history: Metric[];
}

export function DownloadJson({ symptoms, history }: Props) {
  const [shareApiIsAvailable, setShareApiIsAvailable] = useState<boolean>(false);

  useEffect(() => {
    setShareApiIsAvailable(isShareApiAvailable());
  }, []);

  const date = now();

  function download(): void {
    const fileName = generateFilename({ date });
    const blob = generateBlob({ symptoms, history, date });
    downloadFile(blob, fileName);
  }

  function share(): void {
    if (shareApiIsAvailable === false) {
      alert("Your device is not compatible with the Web Share API, sorry :)");
      return;
    }

    const fileName = generateFilename({ date });
    const file = generateFile({
      symptoms: symptoms,
      history: history,
      date,
      fileName,
    });
    shareFile(file);
  }

  return (
    <Container>
      <Button intent="success" text="Download JSON" onClick={() => download()} />
      <Button
        intent="success"
        text="Share"
        onClick={() => share()}
        disabled={shareApiIsAvailable === false}
      />
    </Container>
  );
}

interface GenerateBlobArgs {
  symptoms: Symptom[];
  history: Metric[];
  date: Date;
}
function generateBlob({ symptoms, history, date }: GenerateBlobArgs): Blob {
  const data = {
    date: date.toISOString(),
    symptoms,
    history,
  };

  const formattedJson = JSON.stringify(data, null, 2);
  const blob = new Blob([formattedJson], { type: JSON_MIME_TYPE });

  return blob;
}

function generateFilename({ date }: { date: Date }): string {
  const formattedDate = date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "-")
    .slice(0, 15);
  return `health-tracker__backup_${formattedDate}.txt`;
}

function isShareApiAvailable(): boolean {
  const isAvailable = navigator.share !== undefined;
  return isAvailable;
}

function downloadFile(blob: Blob, filename: string): void {
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

interface GenerateFileArgs {
  symptoms: Symptom[];
  history: Metric[];
  date: Date;
  fileName: string;
}
function generateFile({ symptoms, history, date, fileName }: GenerateFileArgs): File {
  const data = { date: date.toISOString(), symptoms, history };

  const formattedJson = JSON.stringify(data, null, 2);
  const file = new File([formattedJson], fileName, { type: JSON_MIME_TYPE });

  return file;
}
function shareFile(file: File): void {
  const dataToShare: ShareData = {
    title: "fitness-tracker JSON",
    files: [file],
  };

  const canShare = navigator.canShare(dataToShare);
  if (!canShare) {
    alert("You cannot share the JSON for some reason, sorry :)");
    return;
  }

  navigator
    .share(dataToShare)
    .then(() => console.log("all good"))
    .catch((error) => {
      alert(error);
    });
}

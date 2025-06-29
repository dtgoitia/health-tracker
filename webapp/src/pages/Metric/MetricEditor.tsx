import { useApp } from "../..";
import IntensitySelector from "../../components/IntensitySelector";
import NumericIntensitySelector from "../../components/NumericIntensitySelector";
import { formatTime, isSameDay } from "../../lib/datetimeUtils";
import {
  metricsAreEqual,
  NumericIntensity,
  parseNotes,
  setMetricDate,
  setMetricIntensity,
  setMetricNotes,
  setMetricNumericIntensity,
} from "../../lib/domain/metrics";
import { Intensity, Metric, MetricId, Symptom } from "../../lib/domain/model";
import Paths from "../../routes";
import { Button, Dialog, EditableText } from "@blueprintjs/core";
import { DatePicker, TimePrecision } from "@blueprintjs/datetime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

interface Props {
  metric: Metric;
  onUpdate: (metric: Metric) => void;
  onDelete: (id: MetricId) => void;
}

export function MetricEditor({
  metric,
  onUpdate: handleUpdate,
  onDelete: handleDelete,
}: Props) {
  const app = useApp();

  const [symptom, setSymptom] = useState<Symptom | undefined>();
  const [updated, setUpdated] = useState<Metric>({ ...metric });

  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [date, setDate] = useState<Date>(updated.date);

  const time: string = formatTime(updated.date);

  useEffect(() => {
    function _rerender(): void {
      const symptom = app.symptomManager.get(updated.symptomId);
      setSymptom(symptom);
    }

    const subscription = app.symptomManager.changes$.subscribe((_) => _rerender());

    _rerender();

    return () => {
      subscription.unsubscribe();
    };
  }, [app, updated]);

  function handleDateChange(date: Date | null): void {
    setDate(date ? date : metric.date);
  }

  function clearUnsavedDateChanges() {
    setDate(updated.date);
  }

  function closeDateDialog(): void {
    setShowDatePicker(false);
  }

  function handleDateChangeSubmission(date: Date): void {
    const message =
      `DATE CHANGED\n` +
      `\n` +
      `Date changed from:\n` +
      `${metric.date.toISOString()}\n` +
      `to:\n` +
      `${date.toISOString()}\n` +
      `\n` +
      `Do you want to save the changes?`;
    if (isSameDay({ a: metric.date, b: date }) === false && confirm(message) === false) {
      return;
    }

    // the user picked moved the Metric occurrence to a different date
    setUpdated(setMetricDate(updated, date));
    closeDateDialog();
  }

  function handleDateDialogClosure(): void {
    clearUnsavedDateChanges();
    closeDateDialog();
  }

  function handleIntensityChange(intensity: Intensity): void {
    setUpdated(setMetricIntensity(updated, intensity));
  }

  function handleNumericIntensityChange(nIntensity: NumericIntensity): void {
    setUpdated(setMetricNumericIntensity(metric, nIntensity));
  }

  function handleNotesChange(notes: string): void {
    setUpdated(setMetricNotes(updated as Metric, notes));
  }

  function handleSave(): void {
    handleUpdate(updated);
  }

  const hasUnsavedChanges = metricsAreEqual({ a: metric, b: updated });
  const dateChanged = metric.date.getTime() !== date.getTime();

  return (
    <>
      <p>
        ID:&nbsp;&nbsp;&nbsp;<code>{metric.id}</code>
      </p>

      <p>
        symptom:&nbsp;&nbsp;
        {symptom ? (
          <Link to={Paths.symptomsEditor.replace(":symptomId", symptom.id)}>
            {symptom.name}
          </Link>
        ) : (
          `no Symptom found with ID=${updated.symptomId}`
        )}
      </p>

      <Dialog
        title="Select a new date and time"
        isOpen={showDatePicker}
        autoFocus={true}
        canOutsideClickClose={true}
        isCloseButtonShown={true}
        canEscapeKeyClose={true}
        transitionDuration={0}
        onClose={() => handleDateDialogClosure()}
      >
        <div className="bp4-dialog-body">
          <DatePicker
            value={date}
            defaultValue={updated.date}
            timePrecision={TimePrecision.MINUTE}
            shortcuts={true}
            highlightCurrentDay={true}
            timePickerProps={{ showArrowButtons: true }}
            onChange={handleDateChange}
          />
        </div>
        <div className="bp4-dialog-footer">
          {dateChanged && (
            <p>
              previous date: <code>{metric.date.toISOString()}</code>
            </p>
          )}
          <Button
            icon="undo"
            text="Discard changes"
            minimal={false}
            onClick={() => clearUnsavedDateChanges()}
            disabled={dateChanged === false}
          />
          <Button
            icon="floppy-disk"
            text="Save"
            intent="primary"
            minimal={false}
            onClick={() => handleDateChangeSubmission(date)}
            disabled={dateChanged === false}
          />
        </div>
      </Dialog>

      <EditTime>
        <Button
          icon="edit"
          text={time}
          minimal={true}
          onClick={() => setShowDatePicker(!showDatePicker)}
        />
      </EditTime>

      <IntensitySelector
        selectedIntensity={updated.intensity}
        onSelect={handleIntensityChange}
      />

      <NumericIntensitySelector
        selected={parseNotes(updated.notes).nIntensity}
        onSelect={handleNumericIntensityChange}
      />

      <NotesContainer>
        <label>Observations:</label>
        <Notes
          placeholder="add observations here..."
          value={updated.notes}
          multiline={true}
          minLines={3}
          onChange={handleNotesChange}
        />
      </NotesContainer>

      <pre>{JSON.stringify(updated, null, 2)}</pre>

      <MainActions>
        <Button
          icon="trash"
          text="delete"
          onClick={() => handleDelete(metric.id)}
          intent="danger"
        />
        <Button
          icon="floppy-disk"
          text="Save"
          onClick={() => handleSave()}
          intent="success"
          disabled={hasUnsavedChanges}
        />
      </MainActions>
    </>
  );
}

const editWidth = 5;
const EditTime = styled.div`
  flex-basis: ${editWidth}rem;
  flex-shrink: 0;
  flex-grow: 0;
  align-self: center;
`;

const NotesContainer = styled.div`
  margin: 1rem 0;
`;

const Notes = styled(EditableText)`
  font-size: 0.9rem;
  max-width: 100%;
  border: 1px dashed gray;
`;

const MainActions = styled.div`
  flex-basis: 1rem;
  flex-shrink: 0;
  flex-grow: 0;
  align-self: center;

  display: flex;
  justify-content: space-between;
`;

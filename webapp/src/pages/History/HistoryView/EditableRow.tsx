import IntensitySelector from "../../../components/IntensitySelector";
import { isSameDay } from "../../../datetimeUtils";
import {
  setMetricDate,
  setMetricIntensity,
  setMetricNotes,
} from "../../../lib/domain/metrics";
import { Metric, Symptom, Intensity } from "../../../lib/domain/model";
import { formatTime } from "./datetime";
import { Button, Dialog, EditableText } from "@blueprintjs/core";
import { TimePrecision, DatePicker } from "@blueprintjs/datetime";
import { useState } from "react";
import styled from "styled-components";

const selectWidth = 0.9;
const editWidth = 5;
const SelectRow = styled.div`
  flex-basis: ${selectWidth}rem;
  flex-shrink: 0;
  flex-grow: 0;
  align-self: center;
  justify-content: center;
`;
const EditTime = styled.div`
  flex-basis: ${editWidth}rem;
  flex-shrink: 0;
  flex-grow: 0;
  align-self: center;
`;
const SymptomName = styled.div`
  flex-grow: 1;
  flex-shrink: 0;
  align-self: center;
`;
const DeleteMetric = styled.div`
  flex-basis: 1rem;
  flex-shrink: 0;
  flex-grow: 0;
  align-self: center;
`;
const Notes = styled.div`
  align-self: center;
  padding-left: ${selectWidth + editWidth}rem;
  font-size: 0.8rem;
  max-width: 100%;
`;

const Container = styled.div`
  margin-bottom: 0.2rem;
`;

const TopLine = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: stretch;
  margin-bottom: 0.2rem;
`;

const BottomLine = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: stretch;
  margin-bottom: 0.2rem;
`;

interface RowProps {
  symptom: Symptom;
  metric: Metric;
  selected: boolean;
  onDelete: () => void;
  onChange: (updated: Metric) => void;
  onToggleSelect: () => void;
}
function EditableRow({
  symptom,
  metric,
  selected,
  onDelete,
  onChange,
  onToggleSelect,
}: RowProps) {
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [date, setDate] = useState<Date>(metric.date);

  const time: string = formatTime(metric.date);

  function handleDateChange(date: Date | null): void {
    setDate(date ? date : metric.date);
  }

  function clearUnsavedDateChanges() {
    setDate(metric.date);
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
    onChange(setMetricDate(metric, date));
    closeDateDialog();
  }

  function handleDateDialogClosure(): void {
    clearUnsavedDateChanges();
    closeDateDialog();
  }

  function handleIntensityChange(intensity: Intensity): void {
    onChange(setMetricIntensity(metric, intensity));
  }

  function handleNotesChange(notes: string): void {
    onChange(setMetricNotes(metric, notes));
  }

  const dateChanged = metric.date.getTime() !== date.getTime();

  return (
    <Container>
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
            defaultValue={metric.date}
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

      <TopLine>
        <SelectRow>
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
        </SelectRow>
        <EditTime>
          <Button
            icon="edit"
            text={time}
            minimal={true}
            onClick={() => setShowDatePicker(!showDatePicker)}
          />
        </EditTime>
        <SymptomName>{symptom.name}</SymptomName>

        <IntensitySelector
          selectedIntensity={metric.intensity}
          onSelect={handleIntensityChange}
        />

        <DeleteMetric>
          <Button icon="trash" minimal={true} onClick={onDelete} />
        </DeleteMetric>
      </TopLine>

      <BottomLine>
        <Notes>
          <EditableText
            multiline={false}
            placeholder={`observations...`}
            value={metric.notes}
            onChange={handleNotesChange}
          />
        </Notes>
      </BottomLine>
    </Container>
  );
}

export default EditableRow;

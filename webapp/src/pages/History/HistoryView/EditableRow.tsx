import IntensitySelector from "../../../components/IntensitySelector";
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

  const time: string = formatTime(metric.date);

  function handleDateChange(date: Date) {
    onChange(setMetricDate(metric, date));
  }

  function handleIntensityChange(intensity: Intensity): void {
    onChange(setMetricIntensity(metric, intensity));
  }

  function handleNotesChange(notes: string): void {
    onChange(setMetricNotes(metric, notes));
  }

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
        onClose={() => setShowDatePicker(false)}
      >
        <div className="bp4-dialog-body">
          <DatePicker
            value={metric.date}
            defaultValue={metric.date}
            timePrecision={TimePrecision.MINUTE}
            shortcuts={true}
            highlightCurrentDay={true}
            timePickerProps={{ showArrowButtons: true }}
            onChange={handleDateChange}
          />
        </div>
        <div className="bp4-dialog-footer">Changes are saved automatically</div>
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

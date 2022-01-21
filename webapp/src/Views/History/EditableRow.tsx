import { Symptom, Metric } from "../../domain";
import { formatTime } from "./datetime";
import { Button, Dialog } from "@blueprintjs/core";
import { TimePrecision, DatePicker } from "@blueprintjs/datetime";
import { useState } from "react";
import styled from "styled-components";

const x = 5;
const EditTime = styled.div`
  flex-basis: ${x}rem;
  flex-shrink: 0;
  flex-grow: 0;
  align-self: center;
`;
const SymptomName = styled.div`
  flex-grow: 1;
  flex-shrink: 0;
  align-self: center;
`;
const Intensity = styled.div`
  flex-basis: 4rem;
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
  padding-left: ${x}rem;
  font-size: 0.8rem;
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
  onDelete: () => void;
  onChange: (updated: Metric) => void;
}
function EditableRow({
  symptom,
  metric,
  onDelete,
  onChange,
}: RowProps) {
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const time: string = formatTime(metric.date);

  function onDateInputChange(newDate: Date) {
    const updated: Metric = { ...metric, date: newDate };
    onChange(updated);
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
            onChange={onDateInputChange}
          />
        </div>
        <div className="bp4-dialog-footer">Changes are saved automatically</div>
      </Dialog>

      <TopLine>
        <EditTime>
          <Button
            icon="edit"
            text={time}
            minimal={true}
            onClick={() => setShowDatePicker(!showDatePicker)}
          />
        </EditTime>
        <SymptomName>{symptom.name}</SymptomName>

        <Intensity>{metric.intensity}</Intensity>
        <DeleteMetric>
          <Button icon="trash" minimal={true} onClick={onDelete} />
        </DeleteMetric>
      </TopLine>

      <BottomLine>
        <Notes>{metric.notes}</Notes>
      </BottomLine>
    </Container>
  );
}

export default EditableRow;

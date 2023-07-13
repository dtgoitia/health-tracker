import { Symptom, SymptomId } from "../../domain/model";
import { Button, Collapse } from "@blueprintjs/core";
import styled from "styled-components";

const GrayedOut = styled.span`
  opacity: 0.3;
`;

interface SelectableItempProps {
  item: Symptom;
  onClick: (id: SymptomId) => void;
}
function SelectableItem({ item, onClick }: SelectableItempProps) {
  const otherNames = item.otherNames ? item.otherNames.join(", ") : "";
  return (
    <div>
      <Button onClick={() => onClick(item.id)} className="bp4-button bp4-minimal">
        <span>
          {item.name} <GrayedOut>{otherNames}</GrayedOut>
        </span>
      </Button>
    </div>
  );
}
interface InventoryViewProps {
  symptoms: Symptom[];
  selectSymptom: (id: SymptomId) => void;
  collapse: boolean;
}
function InventoryView({ symptoms, selectSymptom, collapse }: InventoryViewProps) {
  const isOpen = !collapse;
  return (
    <div>
      <Collapse isOpen={isOpen}>
        <ol>
          {symptoms.map((symptom) => {
            return (
              <SelectableItem
                key={`item-${symptom.id}`}
                item={symptom}
                onClick={selectSymptom}
              />
            );
          })}
        </ol>
      </Collapse>
    </div>
  );
}

export default InventoryView;

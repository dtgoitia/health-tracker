import { NumericIntensity, POSSIBLE_NUMERIC_INTENSITIES } from "../lib/domain/metrics";
import styled from "styled-components";

interface Props {
  selected: NumericIntensity | undefined;
  onSelect: (label: NumericIntensity) => void;
}
function NumericIntensitySelector({ selected, onSelect }: Props) {
  const buttons = [...POSSIBLE_NUMERIC_INTENSITIES].map((nIntensity) => {
    const classNameIfSelected = nIntensity === selected ? "bp4-intent-success" : "";

    return (
      <button
        key={`ribbon-intensity-button-${nIntensity}`}
        type="button"
        className={`bp4-button bp4 bp4-large ${classNameIfSelected}`}
        onClick={() => onSelect(nIntensity)}
      >
        {nIntensity}
      </button>
    );
  });

  return (
    <Container>
      <ButtonRibbon className="bp4-button-group">{buttons}</ButtonRibbon>
    </Container>
  );
}

export default NumericIntensitySelector;

const ButtonRibbon = styled.div`
  display: flex;
  margin: 0 0.5rem;
`;
const Container = styled.div`
  flex-basis: 4rem;
  flex-shrink: 0;
  align-self: center;
  padding: 1rem 0;
`;

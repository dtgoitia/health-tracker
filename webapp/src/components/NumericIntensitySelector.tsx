import { Intensity, Notes } from "../lib/domain/model";
import styled from "styled-components";

export type NumericIntensity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

interface Props {
  selected: NumericIntensity | undefined;
  onSelect: (label: NumericIntensity) => void;
}
function NumericIntensitySelector({ selected, onSelect }: Props) {
  const options: NumericIntensity[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const buttons = [...options].map((nIntensity) => {
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

export function numberIntensityToIntensity(n: NumericIntensity): Intensity {
  return {
    1: Intensity.low,
    2: Intensity.low,
    3: Intensity.low,
    4: Intensity.medium,
    5: Intensity.medium,
    6: Intensity.medium,
    7: Intensity.high,
    8: Intensity.high,
    9: Intensity.high,
    10: Intensity.high,
  }[n];
}

const NOTE_WITH_NUMERIC_INTENSITY = /^(?<nIntensity>[1-9]|10)\/10\s?-?\s?(?<notes>.*)/;

interface ParsedNote {
  nIntensity: NumericIntensity | undefined;
  notes: Notes;
}

/**
 * Parse a `Metric.note` and extract the numeric intensity and the remainder
 * of the note.
 *
 * Example: the following input
 *
 * ```text
 * 1/10 - something cool
 * ```
 *
 * returns
 *
 * ```text
 * { nIntensity: NumericIntensity; notes: string }
 * ```
 *
 */
export function parseNotes(notes: Notes): ParsedNote {
  const result = NOTE_WITH_NUMERIC_INTENSITY.exec(notes);
  if (!result?.groups) {
    return { nIntensity: undefined, notes };
  }

  const nIntensity = Number(result.groups["nIntensity"]) as NumericIntensity;
  const trimmed = result.groups["notes"];
  return { nIntensity, notes: trimmed };
}

import { formatTime } from "../../../lib/datetimeUtils";
import { Metric, Symptom } from "../../../lib/domain/model";
import styled from "styled-components";

const Col1 = styled.div`
  order: 1;
  flex-basis: 3rem;
  flex-shrink: 0;
  margin-left: 0.3rem;
`;
const Col2 = styled.div`
  order: 2;
  flex-grow: 1;
  flex-shrink: 0;
`;
const Col3 = styled.div`
  order: 3;
  flex-basis: 4rem;
  flex-shrink: 0;
`;
const Col5 = styled.div`
  order: 5;
  flex-basis: 7rem;
  flex-shrink: 0;
`;

const Container = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: stretch;
  margin-bottom: 0.2rem;
`;

interface RowProps {
  symptom: Symptom;
  metric: Metric;
}
function Row({ symptom, metric }: RowProps) {
  const time = formatTime(metric.date);
  return (
    <Container>
      <Col1>{time}</Col1>
      <Col2>{symptom.name}</Col2>
      <Col3>{metric.intensity}</Col3>
      <Col5>{metric.notes}</Col5>
    </Container>
  );
}

export default Row;

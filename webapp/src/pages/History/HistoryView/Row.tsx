import { formatTime } from "../../../lib/datetimeUtils";
import { Intensity, Metric, Symptom } from "../../../lib/domain/model";
import Paths from "../../../routes";
import { Link } from "react-router-dom";
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
  flex-basis: 2rem;
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
  const path = Paths.metric.replace(":metricId", metric.id);
  const time = formatTime(metric.date);

  const intensityLabel = {
    [Intensity.low]: "L",
    [Intensity.medium]: "M",
    [Intensity.high]: "H",
  }[metric.intensity];

  return (
    <Container>
      <Col1>{time}</Col1>
      <Col2>
        <Link to={path}>{symptom.name}</Link>
      </Col2>
      <Col3>{intensityLabel}</Col3>
      <Col5>{metric.notes}</Col5>
    </Container>
  );
}

export default Row;

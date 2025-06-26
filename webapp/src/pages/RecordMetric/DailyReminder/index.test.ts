import { Intensity, Metric } from "../../../lib/domain/model";
import { enrichAndSquashMetrics } from "./index";
import { describe, expect, it } from "vitest";

const todayAt = (t: string) => new Date(`2000-01-04 ${t} +00:00`);
const yesterdayAt = (t: string) => new Date(`2000-01-03 ${t} +00:00`);

const buildMetric = (id: string, symptomId: string, d: Date): Metric => ({
  id,
  symptomId,
  date: d,
  intensity: Intensity.medium,
  notes: "",
  lastModified: new Date("2025-06-26 10:32:21+01:00"),
});

describe("enrich and squash metrics", () => {
  const symptomA = "sym_a";
  const symptomB = "sym_b";

  const m1 = buildMetric("met_1", symptomA, todayAt("13:00:00"));
  const m2 = buildMetric("met_2", symptomA, todayAt("12:00:00"));
  const m3 = buildMetric("met_3", symptomA, yesterdayAt("18:01:00"));
  const m4 = buildMetric("met_4", symptomA, yesterdayAt("18:00:00"));
  const m5 = buildMetric("met_5", symptomB, yesterdayAt("10:00:00"));

  const now = todayAt("14:00:00");

  it(`one today`, () => {
    const metrics: Metric[] = [m1];
    const expected = [{ ...m1, recordedToday: true, recordedInThePast: false }];
    expect(enrichAndSquashMetrics(metrics, now)).toEqual(expected);
  });

  it(`many today`, () => {
    const metrics: Metric[] = [m1, m2];
    const expected = [{ ...m1, recordedToday: true, recordedInThePast: false }];
    expect(enrichAndSquashMetrics(metrics, now)).toEqual(expected);
  });

  it(`one past`, () => {
    const metrics: Metric[] = [m3];
    const expected = [{ ...m3, recordedToday: false, recordedInThePast: true }];
    expect(enrichAndSquashMetrics(metrics, now)).toEqual(expected);
  });

  it(`many past`, () => {
    const metrics: Metric[] = [m3, m4];
    const expected = [{ ...m3, recordedToday: false, recordedInThePast: true }];
    expect(enrichAndSquashMetrics(metrics, now)).toEqual(expected);
  });

  it(`one today and one past`, () => {
    const metrics: Metric[] = [m1, m3];
    const expected = [{ ...m1, recordedToday: true, recordedInThePast: true }];
    expect(enrichAndSquashMetrics(metrics, now)).toEqual(expected);
  });

  it(`normal scenario`, () => {
    const metrics: Metric[] = [m1, m2, m3, m5];

    const expected = [
      { ...m1, recordedToday: true, recordedInThePast: true },
      { ...m5, recordedToday: false, recordedInThePast: true },
    ];

    expect(enrichAndSquashMetrics(metrics, now)).toEqual(expected);
  });
});

export type Milliseconds = number;

export function now(): Date {
  return new Date(new Date().setMilliseconds(0));
}

function today(): Date {
  const _now = now();
  return new Date(_now.getUTCFullYear(), _now.getUTCMonth(), _now.getUTCDate());
}

function n_days(n: number): Milliseconds {
  return n * 1000 * 60 * 60 * 24;
}

export function yesterday(): Date {
  const _today = datetimeToMs(today());
  return new Date(_today - n_days(1));
}

export function getDay(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function datetimeToMs(date: Date): Milliseconds {
  return date.getTime();
}

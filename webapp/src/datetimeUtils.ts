export type Milliseconds = number;
export type DayAmount = number;

export function now(): Date {
  return new Date(new Date().setMilliseconds(0));
}

function today(): Date {
  const _now = now();
  return new Date(_now.getUTCFullYear(), _now.getUTCMonth(), _now.getUTCDate());
}

function n_days({ n }: { n: DayAmount }): Milliseconds {
  return n * 1000 * 60 * 60 * 24;
}

export function n_days_ago({ n }: { n: DayAmount }): Date {
  const _today = datetimeToMs(today());
  return new Date(_today - n_days({ n }));
}

export function getDay(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function datetimeToMs(date: Date): Milliseconds {
  return date.getTime();
}

/**
 * Return the `n` last dates, including today. `n` must be > 0
 */
export function getLastNDates({ n }: { n: DayAmount }): Date[] {
  if (n <= 0) {
    return [];
  }

  const result: Date[] = [today()];

  for (let date_diff = 1; date_diff < n; date_diff++) {
    const date = n_days_ago({ n: date_diff });
    result.push(date);
  }

  return result;
}

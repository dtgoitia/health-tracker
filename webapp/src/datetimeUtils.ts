export type Milliseconds = number;
export type DayAmount = number;

export function now(): Date {
  return new Date(new Date().setMilliseconds(0));
}

/* Return the provided `Date` with hours, minutes, seconds and milliseconds to zero. */
export function toDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function today(): Date {
  return toDay(now());
}

function yesterday(): Date {
  const todayMidnight = toDay(now()).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  return new Date(todayMidnight - oneDay);
}

function nDays({ n }: { n: DayAmount }): Milliseconds {
  return n * 1000 * 60 * 60 * 24;
}

export function nDaysAgo({ n }: { n: DayAmount }): Date {
  const todayLocalMidnight = toDay(now()).getTime();
  return new Date(todayLocalMidnight - nDays({ n }));
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
    const date = nDaysAgo({ n: date_diff });
    result.push(date);
  }

  return result;
}

/**
 * Return the earliest of both provided `Date`s
 */
export function latest({ a, b }: { a: Date; b: Date }): Date {
  return a.getTime() < b.getTime() ? b : a;
}

export function toISOStringWithLocalTimezone(date: Date) {
  const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // In 2023, apparently Swedish (sv-SE) is the closest locale to ISO format amongst all locales.
  // Even "ISO" and "UTC" locales return widely different results.
  return Intl.DateTimeFormat("sv-SE", {
    timeZone: localTZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    // fractionalSecondDigits: 0,
    hour12: false,
    timeZoneName: "short",
  })
    .format(date)
    .replace(/ GMT([+-])(.*)/, " $10$2:00");
}

/**
 * Returns `true` if both dates have the same date in the local time of the device.
 */
export function isSameDay({ a, b }: { a: Date; b: Date }): boolean {
  return (
    // make sure to use local time
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

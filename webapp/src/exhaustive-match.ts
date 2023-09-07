export function assertNever(value: never, error?: string): never {
  throw new Error(
    error ? error : `BUG: please make sure this value never reaches here: ${value}`
  );
}

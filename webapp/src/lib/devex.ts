export function todo(errorMessage?: string): never {
  throw errorMessage
    ? new Error(`TODO: ${errorMessage}`)
    : new Error("TODO: not implemented yet :)");
}

export function unreachable(message: string | undefined = undefined): Error {
  const prefix = `This code path should have never been executed`;
  return new Error(message ? `${prefix}: ${message}` : prefix);
}

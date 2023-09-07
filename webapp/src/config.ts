export const STORAGE_PREFIX = "health";
export const REMOTE_LOOP_WAIT: number = 5; // seconds to wait between each iteration

// When pulling last changes, other clients can be pushing at the same time. To avoid
// missing anything, shift the 'last pulled' date back in time to create an overlap
// with the last pulled time.
export const PULL_OVERLAP_SECONDS: number = 30;

let offsetMs = 0;

/**
 * Updates the estimated difference between the server clock and the device clock
 * (`serverTime - deviceTime`) using an HTTP response's `date` header or a known
 * server timestamp (`startedAt`).
 */
export function recordServerTime(isoOrDateHeader?: string | null) {
  if (!isoOrDateHeader) return;
  const serverMs = Date.parse(isoOrDateHeader);
  if (Number.isFinite(serverMs)) {
    offsetMs = serverMs - Date.now();
  }
}

/** Current time on the server (in epoch milliseconds). */
export function serverNowMs(): number {
  return Date.now() + offsetMs;
}

/**
 * Remaining seconds on an attempt whose server `startedAt` and `durationMinutes`
 * are known. Independent of whether the user changes the device clock or
 * backgrounds the app.
 */
export function computeRemainingSeconds(startedAtIso: string, durationMinutes: number): number {
  const startMs = Date.parse(startedAtIso);
  if (!Number.isFinite(startMs)) return Math.max(0, durationMinutes * 60);
  const endMs = startMs + durationMinutes * 60 * 1000;
  return Math.max(0, Math.floor((endMs - serverNowMs()) / 1000));
}


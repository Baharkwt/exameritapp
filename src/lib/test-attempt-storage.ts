import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from '@/api/client';
import {
  autosaveAttemptAnswers,
  SavedAttemptAnswer,
  SubmitAnswerInput,
  submitTestAttempt,
  SubmitTestResponse,
} from '@/api/tests';

const STORAGE_PREFIX = 'examerit.attempt.v1.';

export interface LocalAttemptSnapshot {
  testId: string;
  attemptId: number;
  startedAt: string;
  durationMinutes: number;
  answers: Record<number, SavedAttemptAnswer>;
  dirty: boolean;
  pendingSubmit: boolean;
  updatedAt: number;
}

function keyFor(testId: string, attemptId: number): string {
  return `${STORAGE_PREFIX}${testId}.${attemptId}`;
}

export async function readLocalAttempt(
  testId: string,
  attemptId: number,
): Promise<LocalAttemptSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(testId, attemptId));
    if (!raw) return null;
    return JSON.parse(raw) as LocalAttemptSnapshot;
  } catch {
    return null;
  }
}

export async function writeLocalAttempt(snapshot: LocalAttemptSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(
      keyFor(snapshot.testId, snapshot.attemptId),
      JSON.stringify(snapshot),
    );
  } catch {
    /* non-fatal storage failure */
  }
}

export async function clearLocalAttempt(testId: string, attemptId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(testId, attemptId));
  } catch {
    /* ignore */
  }
}

/**
 * Flush local answers to `PUT /api/tests/:testId/attempts/:attemptId/answers`.
 * Idempotent on `(attempt_id, question_id)`. Returns true if synced (or already submitted).
 */
export async function flushAutosave(snapshot: LocalAttemptSnapshot): Promise<boolean> {
  const list = Object.values(snapshot.answers);
  if (list.length === 0) return true;
  try {
    await autosaveAttemptAnswers(snapshot.testId, snapshot.attemptId, list);
    snapshot.dirty = false;
    await writeLocalAttempt(snapshot);
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      // Attempt was already submitted on the server
      snapshot.dirty = false;
      await writeLocalAttempt(snapshot);
      return true;
    }
    return false;
  }
}

/**
 * Submit an attempt with automatic retries for transient/network failures.
 * If the server responds 409 ("This attempt has already been submitted"),
 * we treat it as a successful submission so the caller can immediately
 * navigate to the result/solutions screen.
 */
export async function submitWithRetry(
  testId: string,
  attemptId: number,
  answers: SubmitAnswerInput[],
  maxRetries = 3,
): Promise<{ alreadySubmitted: boolean; response: SubmitTestResponse | null }> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await submitTestAttempt(testId, attemptId, answers);
      await clearLocalAttempt(testId, attemptId);
      return { alreadySubmitted: false, response };
    } catch (e) {
      lastError = e;
      if (e instanceof ApiError) {
        if (e.status === 409) {
          // Already submitted on a prior try — treat as success!
          await clearLocalAttempt(testId, attemptId);
          return { alreadySubmitted: true, response: null };
        }
        // Non-retryable 4xx (e.g. 400/403/404)
        if (e.status && e.status >= 400 && e.status < 500) {
          throw e;
        }
      }
      // Wait briefly before retrying network/5xx errors
      await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
    }
  }

  throw lastError;
}


import { api, toApiError } from './client';

/** GET & PUT /api/student-state/live-tests (backend/routes/studentState.js) */
export interface LiveTestRegistration {
  test_id: string;
  status: 'registered' | 'in_progress' | 'completed';
  registered_at: string;
  completed_at: string | null;
  score: number | null;
}

/** GET /api/leaderboard/global (backend/routes/leaderboard.js) */
export interface GlobalLeaderboardRow {
  rank: number;
  id: number;
  name: string;
  avatar: string | null;
  total_points: number;
  current_streak: number;
  total_quizzes_taken: number;
}

export interface GlobalLeaderboardResponse {
  leaderboard: GlobalLeaderboardRow[];
  user_rank: number;
}

/** GET /api/leaderboard/quiz/:quizId */
export interface QuizLeaderboardRow {
  rank: number;
  id: number;
  name: string;
  avatar: string | null;
  score: number;
  duration: number | null;
  date: string;
}

export interface QuizLeaderboardResponse {
  leaderboard: QuizLeaderboardRow[];
  user_rank: number;
}

export async function getLiveTestRegistrations(): Promise<LiveTestRegistration[]> {
  try {
    const { data } = await api.get<LiveTestRegistration[]>('/student-state/live-tests');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function upsertLiveTestRegistration(
  testId: string,
  body: { status: 'registered' | 'in_progress' | 'completed'; score?: number | null },
): Promise<LiveTestRegistration> {
  try {
    const { data } = await api.put<LiveTestRegistration>(
      `/student-state/live-tests/${encodeURIComponent(testId)}`,
      body,
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getGlobalLeaderboard(): Promise<GlobalLeaderboardResponse> {
  try {
    const { data } = await api.get<GlobalLeaderboardResponse>('/leaderboard/global');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getQuizLeaderboard(quizId: string): Promise<QuizLeaderboardResponse> {
  try {
    const { data } = await api.get<QuizLeaderboardResponse>(
      `/leaderboard/quiz/${encodeURIComponent(quizId)}`,
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}


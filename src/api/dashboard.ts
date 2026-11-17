import { api, toApiError } from './client';

/** GET /api/quiz/streak (backend/routes/quiz.js) */
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastQuizDate: string | null;
  totalQuizzesTaken: number;
  totalPoints: number;
  unlockedRewards: string[];
  dailyGoalCompleted: boolean;
}

/** GET /api/exam-alerts/personalized (backend/routes/examAlerts.js) */
export interface ExamAlertAction {
  id: number;
  action_type: string;
  label: string;
  url: string;
}

export interface ExamAlertItem {
  id: number;
  cycle_id: number;
  update_type: string;
  title: string;
  summary: string | null;
  description: string | null;
  is_featured: boolean;
  event_date: string | null;
  published_at: string | null;
  is_new: boolean;
  exam_id: string;
  exam_name: string;
  exam_logo: string | null;
  cycle_slug: string | null;
  cycle_label: string | null;
  cycle_year: number | null;
  application_start: string | null;
  application_end: string | null;
  exam_date_display: string | null;
  total_vacancies: number | null;
  qualification: string | null;
  location: string | null;
  is_followed: boolean;
  is_targeted: boolean;
  actions: ExamAlertAction[];
}

export interface PersonalizedAlertsResponse {
  alerts: ExamAlertItem[];
  hasTargetExams: boolean;
  hasFollowedExams: boolean;
}

/** GET /api/me/exam-progress/:examId (backend/routes/tests.js) */
export interface ExamTestProgress {
  test_id: string;
  attempt_count: number;
  completed: boolean;
  in_progress: boolean;
  latest_score: string | number | null;
  max_score: string | number | null;
  time_taken_sec: number | null;
  last_submitted_at: string | null;
}

export async function getStreak(): Promise<StreakData> {
  try {
    const { data } = await api.get<StreakData>('/quiz/streak');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getPersonalizedExamAlerts(): Promise<PersonalizedAlertsResponse> {
  try {
    const { data } = await api.get<PersonalizedAlertsResponse>('/exam-alerts/personalized');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getExamProgress(examId: string): Promise<ExamTestProgress[]> {
  try {
    const { data } = await api.get<ExamTestProgress[]>(`/me/exam-progress/${encodeURIComponent(examId)}`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}


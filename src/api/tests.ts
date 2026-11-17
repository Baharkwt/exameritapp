import { api, toApiError } from './client';

export type AnswerState =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_for_review'
  | 'answered_and_marked';

/** GET /api/tests/:testId (backend/routes/tests.js) */
export interface TestMetadata {
  id: string;
  name: string;
  duration_minutes: number;
  official_cutoff: string | number | null;
  total_questions: number;
  max_score: string | number;
  difficulty: string | null;
  access_tier: 'free' | 'plan' | 'package' | 'both' | string;
  status: string;
  published_at: string | null;
  category_id: string | null;
  subject_id: number | null;
  format: string | null;
  format_label: string | null;
  stage_name: string | null;
  exam_id: string | null;
  subject_key: string | null;
  subject_label: string | null;
  category_name: string | null;
}

/** GET /api/tests/:testId/sections */
export interface TestSection {
  section_key: string;
  name: string;
  display_order: number;
  duration_minutes: number | null;
}

/** GET /api/tests/:testId/questions */
export interface TestQuestionOption {
  id: string;
  text: string;
}

export interface TestQuestionSet {
  setId: string;
  setType: string;
  sharedContent: string;
}

export interface TestQuestion {
  section_key: string;
  order_index: number;
  marks: string | number;
  negative_marks: string | number;
  topic: string | null;
  category_topic_id: number | null;
  question_id: number;
  question_text: string;
  question_type: 'mcq' | 'msq' | 'numerical' | string;
  options: TestQuestionOption[] | null;
  difficulty: string | null;
  sets: TestQuestionSet | null;
}

/** POST /api/tests/:testId/attempts */
export interface StartAttemptResponse {
  attemptId: number;
  attemptNumber: number;
  testSessionId: number | null;
  startedAt: string;
}

/** GET & PUT /api/tests/:testId/attempts/:attemptId/answers */
export interface SavedAttemptAnswer {
  questionId: number;
  sectionKey: string;
  selectedAnswer: string | string[] | null;
  answerState: AnswerState;
  timeSpentSec: number;
}

export interface GetAttemptAnswersResponse {
  attemptId: number;
  status: string;
  startedAt: string;
  answers: SavedAttemptAnswer[];
}

/** POST /api/tests/:testId/submit */
export interface SubmitAnswerInput {
  questionId: number;
  selectedAnswer: string | string[] | null;
  answerState: AnswerState;
  timeSpentSec?: number | null;
}

export interface SubmittedQuestionOutcome {
  questionId: number;
  isCorrect: boolean;
  marksAwarded: number;
  correctAnswer: string[] | string | null;
  explanation: string | null;
  topic: string | null;
  subject: string | null;
}

export interface SubmitTestResponse {
  attemptId: number;
  status: 'submitted';
  resultLocked: boolean;
  resultReleaseAt?: string | null;
  score?: number;
  maxScore?: number;
  percentage?: number;
  answers?: SubmittedQuestionOutcome[];
}

/** GET /api/tests/:testId/attempts/:attemptId/result */
export interface AttemptResultAnswer {
  questionId: number;
  sectionKey: string;
  orderIndex: number | null;
  selectedAnswer: string | string[] | null;
  answerState: AnswerState;
  timeSpentSec: number | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  correctAnswer: string[] | string | null;
  explanation: string | null;
  topic: string | null;
  subject: string | null;
  questionText: string;
  questionType: string;
  options: TestQuestionOption[] | null;
  sets: TestQuestionSet | null;
  marks: number | null;
  negativeMarks: number | null;
}

export interface AttemptResultResponse {
  attemptId: number;
  testId?: string;
  status: 'submitted';
  resultLocked: boolean;
  resultReleaseAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  timeTakenSec?: number | null;
  answers?: AttemptResultAnswer[];
}

/** GET /api/me/test-attempts?testIds=a,b */
export interface LatestTestAttemptSummary {
  testId: string;
  lastAttempt: {
    attemptId: number;
    attemptNumber: number;
    status: 'in_progress' | 'submitted' | string;
    score: number | null;
    maxScore: number | null;
    submittedAt: string | null;
  } | null;
}

/** GET /api/me/entitlements */
export interface StudentEntitlements {
  planCategoryIds: string[];
  packageCategoryIds: string[];
}

/** GET /api/free-quizzes */
export interface FreeQuizItem {
  id: string;
  title: string;
  subject: string | null;
  subjectLabel: string | null;
  format: string | null;
  formatLabel: string | null;
  questions: number;
  marks: number;
  durationMin: number;
  difficulty: string | null;
  isFeatured: boolean;
  totalAttempts: number;
  attemptState: 'not_started' | 'in_progress' | 'completed';
  lastAttemptId: number | null;
  lastScore: number | null;
  lastMaxScore: number | null;
}

export interface FreeQuizzesResponse {
  category: { id: string; name: string };
  count: number;
  page: number;
  pageSize: number;
  subjects: { key: string; label: string; count: number }[];
  featuredQuizId: string | null;
  quizzes: FreeQuizItem[];
}

/** POST /api/question-reports */
export interface QuestionReportCreateBody {
  categoryId?: string | null;
  examId?: string | null;
  testId: string;
  sectionId: string;
  sectionName: string;
  questionId: number;
  questionNumber?: number;
  reportType: string;
  studentComment?: string;
  questionSnapshot: {
    questionText: string;
    options?: TestQuestionOption[] | null;
    questionType?: string;
  };
  studentSelectedAnswer?: string | string[] | null;
}

export async function getTestMetadata(testId: string): Promise<TestMetadata> {
  try {
    const { data } = await api.get<TestMetadata>(`/tests/${encodeURIComponent(testId)}`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getTestSections(testId: string): Promise<TestSection[]> {
  try {
    const { data } = await api.get<TestSection[]>(`/tests/${encodeURIComponent(testId)}/sections`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getTestQuestions(testId: string): Promise<TestQuestion[]> {
  try {
    const { data } = await api.get<TestQuestion[]>(`/tests/${encodeURIComponent(testId)}/questions`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function startTestAttempt(
  testId: string,
  testSessionId?: number | null,
): Promise<StartAttemptResponse> {
  try {
    const { data } = await api.post<StartAttemptResponse>(
      `/tests/${encodeURIComponent(testId)}/attempts`,
      testSessionId ? { testSessionId } : {},
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getAttemptAnswers(
  testId: string,
  attemptId: number,
): Promise<GetAttemptAnswersResponse> {
  try {
    const { data } = await api.get<GetAttemptAnswersResponse>(
      `/tests/${encodeURIComponent(testId)}/attempts/${attemptId}/answers`,
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function autosaveAttemptAnswers(
  testId: string,
  attemptId: number,
  answers: SavedAttemptAnswer[],
): Promise<{ saved: number }> {
  try {
    const { data } = await api.put<{ saved: number }>(
      `/tests/${encodeURIComponent(testId)}/attempts/${attemptId}/answers`,
      { answers },
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function submitTestAttempt(
  testId: string,
  attemptId: number,
  answers: SubmitAnswerInput[],
): Promise<SubmitTestResponse> {
  try {
    const { data } = await api.post<SubmitTestResponse>(
      `/tests/${encodeURIComponent(testId)}/submit`,
      { attemptId, answers },
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getAttemptResult(
  testId: string,
  attemptId: number,
): Promise<AttemptResultResponse> {
  try {
    const { data } = await api.get<AttemptResultResponse>(
      `/tests/${encodeURIComponent(testId)}/attempts/${attemptId}/result`,
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getMyTestAttempts(testIds: string[]): Promise<LatestTestAttemptSummary[]> {
  if (testIds.length === 0) return [];
  try {
    const { data } = await api.get<{ attempts: LatestTestAttemptSummary[] }>('/me/test-attempts', {
      params: { testIds: testIds.slice(0, 200).join(',') },
    });
    return data.attempts;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getMyEntitlements(): Promise<StudentEntitlements> {
  try {
    const { data } = await api.get<StudentEntitlements>('/me/entitlements');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getFreeQuizzes(params: {
  category: string;
  subject?: string;
  format?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<FreeQuizzesResponse> {
  try {
    const { data } = await api.get<FreeQuizzesResponse>('/free-quizzes', { params });
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function reportQuestion(body: QuestionReportCreateBody): Promise<{ id: number }> {
  try {
    const { data } = await api.post<{ id: number }>('/question-reports', body);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}


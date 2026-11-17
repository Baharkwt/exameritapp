import { api } from './client';

export interface SubjectAccuracy {
  subject: string;
  accuracy: number;
}

export interface TopicAccuracy {
  topic: string;
  accuracy: number;
}

export interface ScoreTrendItem {
  id: string;
  quiz_id: string;
  date: string;
  score: number;
  percentage: number;
}

export interface QuizPerformanceResponse {
  total_quizzes: number;
  avg_score: number;
  avg_accuracy: number;
  best_score: number;
  subject_accuracy: SubjectAccuracy[];
  topic_accuracy: TopicAccuracy[];
  score_trend: ScoreTrendItem[];
}

export interface StudyTimeEntry {
  period_date: string;
  total_time: number;
}

export interface StudyTimeResponse {
  period: 'day' | 'week' | 'month';
  data: StudyTimeEntry[];
}

export interface WeeklyProgressItem {
  week_start: string;
  quizzes_taken: number;
  avg_score: number;
  active_days: number;
}

export interface WeeklyProgressResponse {
  weeks: WeeklyProgressItem[];
}

export interface ExamTopicPerformance {
  exam_id: string;
  exam_name?: string;
  topic: string;
  subject?: string | null;
  attempted: number;
  correct: number;
  unanswered: number;
  accuracy_pct: number;
  avg_time_sec: number;
  last_attempted_at?: string | null;
}

export interface LearningMemorySummary {
  saved_questions: number;
  saved_current_affairs: number;
  saved_vocabulary: number;
  open_mistakes: number;
  revision_due: number;
}

export interface MistakeNotebookItem {
  id: string;
  student_id: string;
  exam_id?: string | null;
  question_id?: string | null;
  syllabus_node_id?: string | null;
  mistake_type?: string[] | string | null;
  note?: string | null;
  resolution_status: 'UNRESOLVED' | 'NEEDS_PRACTICE' | 'RESOLVED';
  question_text?: string | null;
  difficulty?: string | null;
  topic_name?: string | null;
  subject_name?: string | null;
  updated_at?: string;
}

export interface RevisionQueueItem {
  id: string;
  exam_id?: string | null;
  source_type: string;
  source_id?: string | null;
  interval_stage: number;
  due_at: string;
  overdue?: boolean;
  content_type?: string | null;
  content_id?: string | null;
  question_id?: string | null;
  question_text?: string | null;
  topic_name?: string | null;
}

export async function getQuizPerformance(): Promise<QuizPerformanceResponse> {
  const { data } = await api.get<QuizPerformanceResponse>('/analytics/quiz-performance');
  return data;
}

export async function getStudyTime(
  period: 'day' | 'week' | 'month' = 'week',
): Promise<StudyTimeResponse> {
  const { data } = await api.get<StudyTimeResponse>('/analytics/study-time', {
    params: { period },
  });
  return data;
}

export async function getWeeklyProgress(): Promise<WeeklyProgressResponse> {
  const { data } = await api.get<WeeklyProgressResponse>('/analytics/progress');
  return data;
}

export async function getExamTopicPerformance(examId: string): Promise<ExamTopicPerformance[]> {
  const { data } = await api.get<ExamTopicPerformance[] | { items?: ExamTopicPerformance[] }>(
    `/me/topic-performance/${examId}`,
  );
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export async function getLearningSummary(examId?: string): Promise<LearningMemorySummary> {
  const { data } = await api.get<LearningMemorySummary>('/learning/summary', {
    params: examId ? { examId } : undefined,
  });
  return data;
}

export async function getMistakes(params?: {
  examId?: string;
  status?: 'UNRESOLVED' | 'NEEDS_PRACTICE' | 'RESOLVED';
}): Promise<MistakeNotebookItem[]> {
  const { data } = await api.get<MistakeNotebookItem[] | { mistakes?: MistakeNotebookItem[] }>(
    '/learning/mistakes',
    { params },
  );
  if (Array.isArray(data)) return data;
  return data.mistakes ?? [];
}

export async function updateMistake(
  id: string,
  body: {
    mistakeType?: string[];
    note?: string;
    resolutionStatus?: 'UNRESOLVED' | 'NEEDS_PRACTICE' | 'RESOLVED';
  },
): Promise<MistakeNotebookItem> {
  const { data } = await api.patch<MistakeNotebookItem>(`/learning/mistakes/${id}`, body);
  return data;
}

export async function deleteMistake(id: string): Promise<void> {
  await api.delete(`/learning/mistakes/${id}`);
}

export async function getRevisionQueue(examId?: string): Promise<RevisionQueueItem[]> {
  const { data } = await api.get<RevisionQueueItem[] | { items?: RevisionQueueItem[] }>(
    '/learning/revision-queue',
    { params: examId ? { examId } : undefined },
  );
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export async function completeRevisionItem(
  id: string,
): Promise<{ completed?: unknown; next?: unknown; graduated?: boolean }> {
  const { data } = await api.post<{ completed?: unknown; next?: unknown; graduated?: boolean }>(
    `/learning/revision/${id}/complete`,
  );
  return data;
}


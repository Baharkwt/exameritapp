import { api, toApiError } from './client';

/** ── Courses (/api/courses) ────────────────────────────────────── */
export interface CourseItem {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  difficulty: string | null;
  thumbnailUrl: string | null;
  instructorId: number | null;
  instructorName: string | null;
  instructorFullName?: string | null;
  instructorAvatar?: string | null;
  durationHours: number | null;
  enrolledCount: number;
  rating: number | string | null;
  isPublished: boolean;
  isFree: boolean;
  price: number | string | null;
  tags: string[];
  progressPct?: number;
  lastChapterId?: number | null;
  enrolledAt?: string;
}

export interface CourseChapter {
  id: number;
  subjectId: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  durationMinutes: number | null;
  orderIndex: number;
  isFreePreview: boolean;
}

export interface CourseSubject {
  id: number;
  courseId: number;
  title: string;
  description: string | null;
  orderIndex: number;
  chapters: CourseChapter[];
}

export interface CourseDetail extends CourseItem {
  subjects: CourseSubject[];
}

export async function getCourses(params?: {
  category?: string;
  is_free?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ courses: CourseItem[]; total: number }> {
  try {
    const { data } = await api.get<{ courses: CourseItem[]; total: number }>('/courses', {
      params: {
        ...(params?.category ? { category: params.category } : {}),
        ...(params?.is_free !== undefined ? { is_free: String(params.is_free) } : {}),
        ...(params?.search ? { search: params.search } : {}),
        limit: params?.limit ?? 30,
        offset: params?.offset ?? 0,
      },
    });
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getEnrolledCourses(): Promise<CourseItem[]> {
  try {
    const { data } = await api.get<CourseItem[]>('/courses/enrolled');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getCourseDetail(id: number | string): Promise<CourseDetail> {
  try {
    const { data } = await api.get<CourseDetail>(`/courses/${encodeURIComponent(String(id))}`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function enrollInCourse(id: number | string): Promise<{
  userId: number;
  courseId: number;
  progressPct: number;
  enrolledAt: string;
}> {
  try {
    const { data } = await api.post(`/courses/${encodeURIComponent(String(id))}/enroll`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

/** ── Study Materials / PDF Library (/api/materials) ────────────── */
export interface StudyMaterial {
  id: number;
  title: string;
  description: string | null;
  type: string | null;
  category: string | null;
  subject: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  downloadCount: number;
  createdByName?: string | null;
  isFree: boolean;
  isPublished: boolean;
  createdAt: string;
}

export async function getMaterials(params?: {
  type?: string;
  category?: string;
  subject?: string;
  search?: string;
  limit?: number;
}): Promise<{ materials: StudyMaterial[]; total: number }> {
  try {
    const { data } = await api.get<{ materials: StudyMaterial[]; total: number }>('/materials', {
      params: { ...params, limit: params?.limit ?? 40 },
    });
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function downloadMaterial(id: number): Promise<StudyMaterial> {
  try {
    const { data } = await api.post<StudyMaterial>(`/materials/${id}/download`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

/** ── Canonical Syllabus & Topic Progress (/api/syllabus, /api/me/topic-progress) ─ */
export interface CanonicalTopic {
  id: number;
  topicCode: string;
  name: string;
  order: number;
  expectedDifficulty: string | null;
  importance: string | null;
}

export interface CanonicalSubject {
  id: number;
  name: string;
  order: number;
  topics: CanonicalTopic[];
}

export interface CanonicalStage {
  id: number;
  name: string;
  stageType: string | null;
  order: number;
  totalMarks: number | null;
  durationMinutes: number | null;
  negativeMarking: string | null;
  subjects: CanonicalSubject[];
}

export interface CanonicalExamSyllabusResponse {
  exam: { id: string; name: string; logoUrl: string | null };
  category: { id: string; name: string } | null;
  available: boolean;
  reason?: string;
  stages: CanonicalStage[];
}

export interface TopicContentItem {
  type: 'VIDEO' | 'PDF' | 'TEST' | string;
  typeLabel: string;
  title: string;
  url: string | null;
  testId: string | null;
  durationMinutes: number | null;
  questionCount: number | null;
}

export interface TopicContentResponse {
  topic: { id: number; name: string; subject: string };
  level: string;
  levelName: string;
  items: TopicContentItem[];
}

export interface TopicProgressRow {
  topicId: number;
  topicCode: string;
  state: 'not_started' | 'learning' | 'completed' | 'mastered' | string;
  learningProgressPct: number | null;
  masteryScore: number | null;
}

export async function getCanonicalSyllabus(examId: string): Promise<CanonicalExamSyllabusResponse> {
  try {
    const { data } = await api.get<CanonicalExamSyllabusResponse>(
      `/syllabus/canonical/${encodeURIComponent(examId)}`,
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getTopicContent(
  topicId: number,
  level: 'FOUNDATION' | 'CORE' | 'ADVANCED' = 'CORE',
): Promise<TopicContentResponse> {
  try {
    const { data } = await api.get<TopicContentResponse>(
      `/syllabus/canonical/topics/${topicId}/content`,
      { params: { level } },
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getMyTopicProgress(examId?: string): Promise<TopicProgressRow[]> {
  try {
    const { data } = await api.get<{ progress: TopicProgressRow[] }>('/me/topic-progress', {
      params: examId ? { examId } : undefined,
    });
    return data.progress;
  } catch (e) {
    throw toApiError(e);
  }
}

/** ── Current Affairs & Bookmarks (/api/current-affairs, /api/student-state) ─ */
export interface CurrentAffairArticle {
  id: number;
  title: string;
  summary: string | null;
  content?: string | null;
  category: string | null;
  topic: string | null;
  publish_type: string | null;
  source: string | null;
  image_url: string | null;
  tags: string[] | null;
  published_at: string | null;
  created_at: string;
}

export interface BookmarkRow {
  article_id: string;
  kind: string;
  created_at: string;
}

export async function getCurrentAffairs(params?: {
  topic?: string;
  search?: string;
  limit?: number;
}): Promise<{ articles: CurrentAffairArticle[]; total: number }> {
  try {
    const { data } = await api.get<{ articles: CurrentAffairArticle[]; total: number }>(
      '/current-affairs',
      { params: { ...params, limit: params?.limit ?? 30 } },
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getCurrentAffairTopics(): Promise<{ topic: string; count: number }[]> {
  try {
    const { data } = await api.get<{ topic: string; count: number }[]>('/current-affairs/topics');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getCurrentAffairById(id: number | string): Promise<CurrentAffairArticle> {
  try {
    const { data } = await api.get<CurrentAffairArticle>(
      `/current-affairs/${encodeURIComponent(String(id))}`,
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getBookmarks(): Promise<BookmarkRow[]> {
  try {
    const { data } = await api.get<BookmarkRow[]>('/student-state/bookmarks');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function addBookmark(articleId: string | number, kind = 'article'): Promise<void> {
  try {
    await api.post('/student-state/bookmarks', { articleId: String(articleId), kind });
  } catch (e) {
    throw toApiError(e);
  }
}

export async function removeBookmark(articleId: string | number, kind = 'article'): Promise<void> {
  try {
    await api.delete(`/student-state/bookmarks/${encodeURIComponent(String(articleId))}`, {
      params: { kind },
    });
  } catch (e) {
    throw toApiError(e);
  }
}

export async function saveReadingProgress(
  articleId: string | number,
  progressPercent: number,
): Promise<void> {
  try {
    await api.put(`/student-state/reading-progress/${encodeURIComponent(String(articleId))}`, {
      progressPercent,
    });
  } catch (e) {
    throw toApiError(e);
  }
}

/** ── Vocabulary & Practice (/api/vocabulary) ───────────────────── */
export interface VocabularyWord {
  id: number;
  word: string;
  definition: string;
  example_sentence?: string | null;
  synonyms?: string[] | null;
  antonyms?: string[] | null;
  part_of_speech?: string | null;
  difficulty: string | null;
  category: string | null;
  mastery_level?: 'new' | 'learning' | 'review' | 'mastered' | null;
  correct_count?: number;
  incorrect_count?: number;
}

export async function getVocabularyWords(params?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<{ words: VocabularyWord[]; total: number }> {
  try {
    const { data } = await api.get<{ words: VocabularyWord[]; total: number }>('/vocabulary', {
      params: { ...params, limit: params?.limit ?? 40 },
    });
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getVocabularyCategories(): Promise<{ category: string; word_count: string | number }[]> {
  try {
    const { data } = await api.get<{ category: string; word_count: string | number }[]>(
      '/vocabulary/categories',
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getVocabularyPractice(): Promise<VocabularyWord[]> {
  try {
    const { data } = await api.get<VocabularyWord[]>('/vocabulary/practice');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function recordVocabularyProgress(
  wordId: number,
  correct: boolean,
): Promise<void> {
  try {
    await api.post('/vocabulary/progress', { word_id: wordId, correct });
  } catch (e) {
    throw toApiError(e);
  }
}


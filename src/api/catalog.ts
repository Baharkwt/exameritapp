import { api, toApiError } from './client';

/** GET /api/categories (backend/routes/catalog.js) */
export interface Category {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  color_class: string | null;
  is_popular: boolean;
  is_combo: boolean;
  sort_order: number;
  exam_count: number;
}

/** GET /api/exams, GET /api/exams?category=, GET /api/exams?withCategory=true */
export interface CatalogExam {
  id: string;
  name: string;
  logo_url: string | null;
  logo_alt: string | null;
  is_popular: boolean;
  category_id?: string;
  display_order?: number;
  category_is_popular?: boolean;
  popular_sort_order?: number | null;
  exam_group_id?: number | null;
  exam_group_name?: string | null;
  exam_group_slug?: string | null;
  exam_group_order?: number | null;
}

/** GET /api/categories/:categoryId/exam-groups */
export interface ExamGroup {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  exam_count: number;
}

/** GET /api/exams/:examId/stages */
export interface ExamStage {
  id: number;
  name: string;
  stage_order: number;
  total_marks: number | null;
  duration_minutes: number | null;
  negative_marking: string | null;
  sectional_cutoff: boolean | null;
  stage_type: string | null;
  is_mandatory: boolean | null;
  slug: string | null;
  status: string;
  exam_date: string | null;
  registration_start: string | null;
  registration_end: string | null;
  result_date: string | null;
}

/** GET /api/test-formats */
export interface TestFormat {
  id: number;
  key: string;
  label: string;
  sort_order: number;
}

/** GET /api/exams/:examId/published-tests */
export interface PublishedTest {
  id: string;
  name: string;
  access_tier: 'free' | 'paid' | string;
  difficulty: string | null;
  duration_minutes: number;
  exam_stage_id: number | null;
  stage_name: string | null;
  stage_order: number | null;
  test_format_id: number | null;
  format_key: string | null;
  format_label: string | null;
  format_sort_order: number | null;
  question_count: number;
  section_count: number;
  max_score: string | number;
  tab_id: number | null;
  subtab_id: number | null;
  subtab_subject_id: number | null;
}

/** GET /api/exams/:examId/test-tabs */
export interface ExamTestSubtabSubject {
  id: number;
  subtab_id: number;
  name: string;
  sort_order: number;
}

export interface ExamTestSubtab {
  id: number;
  tab_id: number;
  name: string;
  sort_order: number;
  has_subject_sections: boolean;
  subjects: ExamTestSubtabSubject[];
}

export interface ExamTestTab {
  id: number;
  name: string;
  sort_order: number;
  subtabs: ExamTestSubtab[];
}

export async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await api.get<Category[]>('/categories');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getExams(params?: { category?: string; withCategory?: boolean }): Promise<CatalogExam[]> {
  try {
    const { data } = await api.get<CatalogExam[]>('/exams', {
      params: {
        ...(params?.category ? { category: params.category } : {}),
        ...(params?.withCategory ? { withCategory: 'true' } : {}),
      },
    });
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getCategoryExamGroups(categoryId: string): Promise<ExamGroup[]> {
  try {
    const { data } = await api.get<ExamGroup[]>(`/categories/${encodeURIComponent(categoryId)}/exam-groups`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getExamStages(examId: string): Promise<ExamStage[]> {
  try {
    const { data } = await api.get<ExamStage[]>(`/exams/${encodeURIComponent(examId)}/stages`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getTestFormats(): Promise<TestFormat[]> {
  try {
    const { data } = await api.get<TestFormat[]>('/test-formats');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getExamPublishedTests(examId: string): Promise<PublishedTest[]> {
  try {
    const { data } = await api.get<PublishedTest[]>(`/exams/${encodeURIComponent(examId)}/published-tests`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getExamTestTabs(examId: string): Promise<ExamTestTab[]> {
  try {
    const { data } = await api.get<ExamTestTab[]>(`/exams/${encodeURIComponent(examId)}/test-tabs`);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}


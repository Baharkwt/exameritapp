import { api, toApiError } from './client';

/** GET /api/student/categories (backend/routes/studentCategories.js) */
export interface StudentCategory {
  categoryId: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  selectedAt: string;
  selectedBy: string | null;
}

export interface StudentCategoriesResponse {
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  categories: StudentCategory[];
}

/** GET /api/student/targets (backend/routes/studentTargets.js) */
export interface StudentTargetExam {
  id: string;
  name: string;
  category: string;
  isPrimary: boolean;
  priority: number;
  addedAt: number;
  examDate?: string;
}

export async function getStudentCategories(): Promise<StudentCategoriesResponse> {
  try {
    const { data } = await api.get<StudentCategoriesResponse>('/student/categories');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function replaceStudentCategories(
  categoryIds: string[],
  source: 'onboarding' | 'header_selector' = 'header_selector',
): Promise<{ categories: StudentCategory[]; onboardingCompleted: boolean }> {
  try {
    const { data } = await api.put<{ categories: StudentCategory[]; onboardingCompleted: boolean }>(
      '/student/categories',
      { categoryIds, source },
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function addStudentCategory(
  categoryId: string,
  source: 'onboarding' | 'header_selector' = 'header_selector',
): Promise<{ categories: StudentCategory[]; onboardingCompleted: boolean }> {
  try {
    const { data } = await api.post<{ categories: StudentCategory[]; onboardingCompleted: boolean }>(
      `/student/categories/${encodeURIComponent(categoryId)}`,
      { source },
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function removeStudentCategory(categoryId: string): Promise<void> {
  try {
    await api.delete(`/student/categories/${encodeURIComponent(categoryId)}`);
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getStudentTargets(): Promise<StudentTargetExam[]> {
  try {
    const { data } = await api.get<StudentTargetExam[]>('/student/targets');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function addStudentTarget(body: {
  examId: string;
  categoryId: string;
  targetDate?: string | null;
}): Promise<StudentTargetExam> {
  try {
    const { data } = await api.post<StudentTargetExam>('/student/targets', body);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function removeStudentTarget(examId: string): Promise<void> {
  try {
    await api.delete(`/student/targets/${encodeURIComponent(examId)}`);
  } catch (e) {
    throw toApiError(e);
  }
}

export async function reorderStudentTargets(examIds: string[]): Promise<StudentTargetExam[]> {
  try {
    const { data } = await api.put<StudentTargetExam[]>('/student/targets/reorder', { examIds });
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}


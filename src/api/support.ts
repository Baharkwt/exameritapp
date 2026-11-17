import { api } from './client';

export interface NotificationItem {
  id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  is_read: boolean;
  link?: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unread: number;
}

export type VoiceSubmissionCategory =
  | 'suggestion'
  | 'feedback'
  | 'report_problem'
  | 'technical_issue'
  | 'request_content'
  | 'compliment'
  | 'complaint'
  | 'other';

export interface VoiceSubmission {
  id: string;
  ticket_number?: string;
  category: VoiceSubmissionCategory;
  subcategory?: string | null;
  title: string;
  description: string;
  status: string;
  priority?: string;
  is_public?: boolean;
  upvotes_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface VoiceSuggestion {
  id: string;
  ticket_number?: string;
  title: string;
  description: string;
  status: string;
  upvotes_count: number;
  created_at: string;
  has_voted?: boolean;
  comment_count?: number;
}

export interface UserPreferences {
  notification_enabled?: boolean;
  theme?: string;
  language?: string;
}

export async function getNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>('/notifications');
  return {
    notifications: data.notifications ?? [],
    unread: Number(data.unread ?? 0),
  };
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.patch<{ ok: boolean }>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const { data } = await api.patch<{ ok: boolean }>('/notifications/read-all');
  return data;
}

export async function getVoiceSubmissions(): Promise<VoiceSubmission[]> {
  const { data } = await api.get<VoiceSubmission[] | { submissions?: VoiceSubmission[] }>(
    '/student/voice/submissions',
  );
  if (Array.isArray(data)) return data;
  return data.submissions ?? [];
}

export async function createVoiceSubmission(body: {
  category: VoiceSubmissionCategory;
  subcategory?: string;
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isPublic?: boolean;
}): Promise<{ ok: boolean; submission?: VoiceSubmission }> {
  const { data } = await api.post<{ ok: boolean; submission?: VoiceSubmission }>(
    '/student/voice/submissions',
    body,
  );
  return data;
}

export async function getVoiceSuggestions(
  sort: 'popular' | 'recent' = 'popular',
): Promise<VoiceSuggestion[]> {
  const { data } = await api.get<VoiceSuggestion[] | { suggestions?: VoiceSuggestion[] }>(
    '/student/voice/suggestions',
    { params: { sort } },
  );
  if (Array.isArray(data)) return data;
  return data.suggestions ?? [];
}

export async function toggleSuggestionVote(
  id: string,
): Promise<{ ok?: boolean; voted?: boolean; upvotes_count?: number }> {
  const { data } = await api.post<{ ok?: boolean; voted?: boolean; upvotes_count?: number }>(
    `/student/voice/suggestions/${id}/vote`,
  );
  return data;
}

export async function changePassword(body: {
  current_password: string;
  new_password: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.post<{ ok: boolean; message?: string }>('/change-password', body);
  return data;
}

export async function updatePreferences(
  body: UserPreferences,
): Promise<{ ok: boolean; preferences?: UserPreferences }> {
  const { data } = await api.put<{ ok: boolean; preferences?: UserPreferences }>(
    '/users/me/preferences',
    body,
  );
  return data;
}

export async function deactivateAccount(): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.delete<{ ok: boolean; message?: string }>('/users/me');
  return data;
}


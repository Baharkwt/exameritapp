import { api, toApiError } from './client';

export type PreparationLevel = 'just_starting' | 'beginner' | 'intermediate' | 'advanced';

/** GET /users/me (backend/routes/users.js `serialize`). */
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  targetExam: string | null;
  avatar: string | null;
  preparationLevel: PreparationLevel | null;
  preparationStartDate: string | null;
  state: string | null;
  phone: string | null;
}

export interface UpdateProfileBody {
  name?: string;
  avatar?: string | null;
  targetExam?: string | null;
  preparationLevel?: PreparationLevel | null;
  preparationStartDate?: string | null; // YYYY-MM-DD
  state?: string | null;
  phone?: string | null;
}

export async function getMe(): Promise<Profile> {
  try {
    const { data } = await api.get<Profile>('/users/me');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function updateMe(body: UpdateProfileBody): Promise<Profile> {
  try {
    const { data } = await api.put<Profile>('/users/me', body);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}


import { api, toApiError } from './client';

/** Shape returned by POST /auth/login and /auth/register (backend/routes/auth.js). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  targetExam: string | null;
  avatar: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  name: string;
  email: string;
  password: string; // min 8
  phone?: string | null;
}

export async function login(body: LoginBody): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/login', body);
    return data;
  } catch (e) {
    const err = toApiError(e);
    if (err.status === 403) err.message = err.body?.error ?? 'This account is not active.';
    throw err;
  }
}

export async function register(body: RegisterBody): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/register', body);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}


/** Invalidate the session server-side. Best-effort: callers should still clear local state on failure. */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

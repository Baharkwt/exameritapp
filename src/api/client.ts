import { AxiosError, create, isAxiosError } from 'axios';

import { API_BASE_URL } from '@/lib/config';
import { recordServerTime } from '@/lib/clock';
import { clearToken, getToken } from '@/lib/secure-token';

export const api = create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** The auth provider registers this so a 401 sends the user to login. */
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    const dateHeader = res.headers?.date;
    if (typeof dateHeader === 'string') recordServerTime(dateHeader);
    return res;
  },
  async (error: AxiosError) => {
    const dateHeader = error.response?.headers?.date;
    if (typeof dateHeader === 'string') recordServerTime(dateHeader);
    const url = error.config?.url ?? '';
    const isAuthCall = url.startsWith('/auth/');
    // A 401 on login means "wrong credentials", not "session expired".
    if (error.response?.status === 401 && !isAuthCall && getToken()) {
      await clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export interface ApiErrorBody {
  error?: string;
  details?: { field: string; message: string }[];
  [k: string]: unknown;
}

export class ApiError extends Error {
  status: number | null;
  body: ApiErrorBody | null;
  isNetwork: boolean;

  constructor(message: string, status: number | null, body: ApiErrorBody | null, isNetwork = false) {
    super(message);
    this.status = status;
    this.body = body;
    this.isNetwork = isNetwork;
  }
}

/** Turn any thrown value into a readable ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isAxiosError(err)) {
    if (!err.response) {
      return new ApiError('Cannot reach the server. Check your internet connection.', null, null, true);
    }
    const body = (err.response.data ?? null) as ApiErrorBody | null;
    const detail = body?.details?.[0]?.message;
    const msg = detail ?? body?.error ?? `Request failed (${err.response.status})`;
    return new ApiError(msg, err.response.status, body);
  }
  return new ApiError(err instanceof Error ? err.message : 'Something went wrong', null, null);
}


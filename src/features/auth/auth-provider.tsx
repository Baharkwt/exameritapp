import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authApi from '@/api/auth';
import type { AuthUser, LoginBody, RegisterBody } from '@/api/auth';
import { ApiError, setUnauthorizedHandler } from '@/api/client';
import { getMe } from '@/api/users';
import { clearToken, loadToken, saveToken } from '@/lib/secure-token';

interface AuthState {
  /** true until the stored token has been read from secure storage */
  loading: boolean;
  user: AuthUser | null;
  signIn: (b: LoginBody) => Promise<void>;
  signUp: (b: RegisterBody) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const reset = useCallback(() => {
    setUser(null);
    qc.clear();
  }, [qc]);

  // Restore session. The cached user lives only in memory, so we re-fetch /users/me.
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await loadToken();
      if (!token) {
        if (alive) setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        if (!alive) return;
        if (me.role !== 'student') {
          await clearToken();
        } else {
          setUser({
            id: me.id,
            name: me.name,
            email: me.email,
            role: me.role,
            targetExam: me.targetExam,
            avatar: me.avatar,
          });
        }
      } catch (e) {
        // 401 is already handled by the interceptor (token cleared).
        // On a network error keep the token; the user stays signed out of this
        // session but can retry without re-entering a password.
        const status = e instanceof ApiError ? e.status : null;
        if (status === 401 || status === 403 || status === 404) await clearToken();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(reset);
    return () => setUnauthorizedHandler(null);
  }, [reset]);

  const accept = useCallback(async (res: authApi.AuthResponse) => {
    // Student-only app: refuse any other role before persisting the token.
    if (res.user.role !== 'student') {
      throw new ApiError('This app is for students only. Please use the web app.', 403, null);
    }
    await saveToken(res.token);
    setUser(res.user);
  }, []);

  const signIn = useCallback(async (b: LoginBody) => accept(await authApi.login(b)), [accept]);
  const signUp = useCallback(async (b: RegisterBody) => accept(await authApi.register(b)), [accept]);
  const signOut = useCallback(async () => {
    await clearToken(); // there is no logout endpoint: logout = delete the token
    reset();
  }, [reset]);

  const value = useMemo(
    () => ({ loading, user, signIn, signUp, signOut }),
    [loading, user, signIn, signUp, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// dropicture/app/frontend/src/components/UserProvider.tsx
'use client';

import { useState, useEffect, useRef, useContext, useCallback, createContext } from 'react';
import type { SessionUser } from '@/lib/session';
import { consumeReturnTo, redirectToLoginExpired, SESSION_EXPIRED_REASONS } from '@/lib/sessionExpiry';

export interface UserProfile {
  email: string;
  firstname: string;
  lastname: string;
  scope: string;
  roles: string[];
}

interface UserContextValue {
  user: UserProfile | null;
  error: Error | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<Response>;
  signup: (
    firstname: string,
    lastname: string,
    email: string,
    password: string,
  ) => Promise<Response>;
  logout: () => void;
}

export const UserContext = createContext<UserContextValue | null>(null);

const ACCESS_TOKEN_TTL_FALLBACK = 300;
const REFRESH_MARGIN_MS = 60 * 1000;
const MAX_REFRESH_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [1000, 2000, 4000];
const HOME_PATH = '/auth';
const REFRESH_CHANNEL_NAME = 'dropicture:auth:refresh';

type RefreshMessage =
  | { type: 'started' }
  | { type: 'completed'; expiresIn: number }
  | { type: 'failed' };

export const UserProvider = ({
  children,
  initialSessionUser,
  initialAccessTokenExpiresAt,
}: {
  children: React.ReactNode;
  initialSessionUser: SessionUser | null;
  initialAccessTokenExpiresAt?: number;
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!initialSessionUser);

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef<boolean>(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const scheduleTokenRefreshRef = useRef<(expiresInSec: number) => void>(() => { });

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return (data as UserProfile) ?? null;
    } catch {
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await fetchProfile();
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('refreshProfile failed'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const refreshTokenWithRetry = useCallback(async (): Promise<boolean> => {
    if (refreshInFlightRef.current) return true;
    refreshInFlightRef.current = true;
    channelRef.current?.postMessage({ type: 'started' } satisfies RefreshMessage);
    try {
      for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt++) {
        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            credentials: 'include',
          });
          if (response.status === 401 || response.status === 403) {
            channelRef.current?.postMessage({ type: 'failed' } satisfies RefreshMessage);
            setUser(null);
            redirectToLoginExpired(SESSION_EXPIRED_REASONS.EXPIRED);
            return false;
          }
          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            const expiresIn = data.expires_in ?? ACCESS_TOKEN_TTL_FALLBACK;
            scheduleTokenRefreshRef.current(expiresIn);
            channelRef.current?.postMessage({
              type: 'completed',
              expiresIn,
            } satisfies RefreshMessage);
            return true;
          }
        } catch (err) {
          console.warn(`[Auth] Refresh attempt ${attempt + 1} failed:`, err);
        }
        if (attempt < MAX_REFRESH_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
        }
      }
      channelRef.current?.postMessage({ type: 'failed' } satisfies RefreshMessage);
      setError(new Error('Token refresh failed after maximum attempts'));
      return false;
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  const scheduleTokenRefresh = useCallback(
    (expiresInSec: number) => {
      clearRefreshTimer();
      const delay = Math.max(0, expiresInSec * 1000 - REFRESH_MARGIN_MS);
      refreshTimeoutRef.current = setTimeout(() => {
        void refreshTokenWithRetry();
      }, delay);
    },
    [clearRefreshTimer, refreshTokenWithRetry],
  );

  useEffect(() => {
    scheduleTokenRefreshRef.current = scheduleTokenRefresh;
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(REFRESH_CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<RefreshMessage>) => {
      if (event.data.type === 'started') {
        clearRefreshTimer();
      } else if (event.data.type === 'completed') {
        scheduleTokenRefresh(event.data.expiresIn);
      } else if (event.data.type === 'failed') {
        setUser(null);
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [clearRefreshTimer, scheduleTokenRefresh]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!user) return;
      if (!refreshTimeoutRef.current) {
        void refreshTokenWithRetry();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user, refreshTokenWithRetry]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (response.ok) {
          const data = await response.clone().json().catch(() => ({}));
          scheduleTokenRefresh(data.expires_in ?? ACCESS_TOKEN_TTL_FALLBACK);
          const returnTo = consumeReturnTo();
          window.location.href = returnTo ?? HOME_PATH;
        }
        return response;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('login failed');
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [scheduleTokenRefresh],
  );

  const signup = useCallback(
    async (firstname: string, lastname: string, email: string, password: string) => {
      return fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstname, lastname, email, password }),
      });
    },
    [],
  );

  const logout = useCallback(() => {
    clearRefreshTimer();
    setUser(null);
    fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      window.location.href = '/';
    });
  }, [clearRefreshTimer]);

  useEffect(() => {
    if (!initialSessionUser) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const profile = await fetchProfile();
      if (!cancelled) {
        setUser(profile);
        setIsLoading(false);
      }
    })();
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresIn = initialAccessTokenExpiresAt
      ? Math.max(0, initialAccessTokenExpiresAt - nowSec)
      : ACCESS_TOKEN_TTL_FALLBACK;
    scheduleTokenRefresh(expiresIn);
    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        error,
        isLoading,
        refreshProfile,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextValue => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
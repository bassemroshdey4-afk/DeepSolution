'use client';

import { createContext, useContext, ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/lib/utils';

interface User {
  id: string;
  openId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  tenantId?: string;
  tenantName?: string;
  tenantSlug?: string;
}

interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginUrl: string;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = '/';
    },
  });

  const value: AuthContextType = {
    user: user as User | null | undefined,
    isLoading,
    isAuthenticated: !!user,
    loginUrl: getLoginUrl(),
    logout: () => logoutMutation.mutate(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

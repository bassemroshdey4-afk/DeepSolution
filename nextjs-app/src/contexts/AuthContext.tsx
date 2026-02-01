'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { createClient, User as SupabaseUser, Session } from '@supabase/supabase-js';

// Create Supabase client for browser
// CRITICAL: Must use PKCE flow to match login and callback handlers
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only create client if env vars are available
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;

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
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginUrl: string;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from our API
  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        if (userData) {
          setUser(userData);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    // If Supabase is not configured, just set loading to false
    if (!supabase) {
      setIsLoading(false);
      setUser(null);
      return;
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setSupabaseUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchUserProfile();
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);
        
        if (event === 'SIGNED_IN' && newSession?.user) {
          await fetchUserProfile();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      console.error('Supabase not configured');
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    supabaseUser,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    loginUrl: '/login',
    logout,
    signInWithGoogle,
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

// Export supabase client for direct use
export { supabase };

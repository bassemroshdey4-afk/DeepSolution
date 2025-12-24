'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email?: string;
  name?: string;
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession?.user) {
          setSession(initialSession);
          setSupabaseUser(initialSession.user);
          setUser(mapSupabaseUserToUser(initialSession.user));
        } else {
          setSession(null);
          setSupabaseUser(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event);
        
        if (currentSession?.user) {
          setSession(currentSession);
          setSupabaseUser(currentSession.user);
          setUser(mapSupabaseUserToUser(currentSession.user));
        } else {
          setSession(null);
          setSupabaseUser(null);
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      // Still redirect on error
      window.location.href = '/';
    }
  };

  const value: AuthContextType = {
    user,
    supabaseUser,
    session,
    isLoading,
    isAuthenticated: !!user,
    signOut,
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

// Helper function to map Supabase user to our User type
function mapSupabaseUserToUser(supabaseUser: SupabaseUser): User {
  const metadata = supabaseUser.user_metadata || {};
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: metadata.full_name || metadata.name || supabaseUser.email?.split('@')[0],
    avatarUrl: metadata.avatar_url || metadata.picture,
    role: 'user', // Default role, can be updated from database
    tenantId: metadata.tenant_id,
    tenantName: metadata.tenant_name,
    tenantSlug: metadata.tenant_slug,
  };
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearPendingAuth, markPendingAuth } from '../lib/items';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    markPendingAuth('login');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      clearPendingAuth();
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    markPendingAuth('signup');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      clearPendingAuth();
      throw error;
    }
    return data;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Authentication is not configured.');
    markPendingAuth('oauth');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      clearPendingAuth();
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    configured: isSupabaseConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  }), [user, session, loading, signIn, signUp, signInWithGoogle, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Fast Refresh warning is expected: this file exports the provider and its hook.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

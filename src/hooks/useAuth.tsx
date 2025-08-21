import { useEffect } from 'react';
import { useStore } from '@/store';
import { supabase } from '@/integrations/supabase/client';
import { supabaseApi } from '@/lib/supabase-api';

export const useAuth = () => {
  const { auth, setAuth } = useStore();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuth({ session, user: session?.user ?? null });
        
        // Fetch profile when user signs in
        if (session?.user && event === 'SIGNED_IN') {
          setTimeout(async () => {
            try {
              const profile = await supabaseApi.getProfile(session.user.id);
              setAuth({ profile });
            } catch (error) {
              console.error('Failed to fetch profile:', error);
            } finally {
              setAuth({ loading: false });
            }
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setAuth({ profile: null, loading: false });
        } else {
          setAuth({ loading: false });
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setAuth({ session, user: session?.user ?? null });
      
      if (session?.user) {
        try {
          const profile = await supabaseApi.getProfile(session.user.id);
          setAuth({ profile });
        } catch (error) {
          console.error('Failed to fetch profile:', error);
        }
      }
      setAuth({ loading: false });
    });

    return () => subscription.unsubscribe();
  }, [setAuth]);

  return auth;
};
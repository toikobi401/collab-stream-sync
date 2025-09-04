import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { supabase } from '@/integrations/supabase/client';
import { supabaseApi } from '@/lib/supabase-api';

export const useAuth = () => {
  const { auth, setAuth } = useStore();
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Tránh trigger khi chuyển tab (visibility change)
        if (document.hidden && isInitializedRef.current) {
          return;
        }

        console.log('Auth state changed:', event, !!session);
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
        } else if (event === 'TOKEN_REFRESHED') {
          // Chỉ update session, không thay đổi loading state
          setAuth({ session, user: session?.user ?? null });
        } else {
          setAuth({ loading: false });
        }
        
        isInitializedRef.current = true;
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
      isInitializedRef.current = true;
    });

    return () => {
      subscription.unsubscribe();
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [setAuth]);

  // Handle visibility change to prevent auth issues when switching tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Khi tab bị ẩn, clear timeout nếu có
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
          visibilityTimeoutRef.current = null;
        }
      } else {
        // Khi tab được hiện lại, đợi một chút rồi mới check session
        visibilityTimeoutRef.current = setTimeout(async () => {
          if (isInitializedRef.current && !auth.loading) {
            // Chỉ refresh session nếu cần thiết
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session && !auth.session) {
                setAuth({ session, user: session.user });
              }
            } catch (error) {
              console.error('Error refreshing session on visibility change:', error);
            }
          }
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [auth.loading, auth.session, setAuth]);

  return auth;
};
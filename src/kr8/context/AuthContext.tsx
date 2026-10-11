// Production Auth Context - Supabase Auth as source of truth, fresh start
// No claim flow, no legacy accounts, only 3 founders remain
// Founder: Timfire (kr8digitals01@gmail.com, +2348125687509) - email verified ownership
// Co-founders: Daniel +2348106068523, Motionverse +2348089344434 - phone OTP or founder promotion
// Fixed: added addNotification compatibility for LiveStreamContext and other legacy components

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  kr8_id: string;
  name: string;
  email: string;
  phone: string | null;
  phone_normalized: string | null;
  country: string | null;
  dob: string | null;
  skill: string | null;
  avatar: string | null;
  bio: string | null;
  cover_photo: string | null;
  points: number;
  attendance_accepted: number;
  submissions: number;
  referrals: number;
  graduated: boolean;
  cert_tier: string | null;
  cert_recognition: string | null;
  joined: string | null;
  created_at: string | null;
  updated_at: string | null;
  phone_verified: boolean;
};

export type UserRole = {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  permissions: string[] | null;
  granted_by: string | null;
  granted_at: string | null;
};

export type AuthUser = {
  id: string;
  kr8_id: string;
  name: string;
  email: string;
  phone: string | null;
  phone_normalized: string | null;
  country: string | null;
  skill: string | null;
  avatar: string | null;
  bio: string | null;
  cover_photo: string | null;
  points: number;
  attendance_accepted: number;
  submissions: number;
  referrals: number;
  graduated: boolean;
  cert_tier: string | null;
  cert_recognition: string | null;
  joined: string | null;
  roles: UserRole[];
  isAdmin: boolean;
  isHost: boolean;
  isFounder: boolean;
  isCoFounder: boolean;
  type: "student" | "tribe" | "founder" | "co-founder";
  executiveRole?: "Founder" | "Co-Founder";
  title?: string;
  admin?: {
    role: "ultimate" | "admin" | "coach" | "assistant" | "attendance_reviewer";
    title?: string;
    permissions: string[];
  };
  // Legacy compatibility
  countryCode?: string;
  dob?: string;
};

export type Account = AuthUser;

type Notification = { id: string; text: string; ts: number; link?: string | null; read?: boolean };

type AuthCtx = {
  user: AuthUser | null;
  student: AuthUser | null;
  session: Session | null;
  supabaseUser: User | null;
  loading: boolean;
  deviceSessionToken: string | null;
  notifications: Notification[];
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: AuthUser; message?: string }>;
  signUp: (data: { name: string; email: string; phone: string; password: string; country?: string; skill?: string; dob?: string }) => Promise<{ ok: boolean; error?: string; user?: AuthUser; message?: string; kr8_id?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  refreshProfile: () => Promise<void>;
  addNotification: (text: string) => void;
  clearNotifications: () => void;
  // Legacy compat for components that call signIn with Account
  legacySignIn?: (account: any) => void;
};

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '234' + cleaned.substring(1);
  } else if (cleaned.startsWith('234') && cleaned.length === 13) {
    return cleaned;
  } else if (cleaned.length === 10) {
    return '234' + cleaned;
  }
  return cleaned;
}

function mapProfileToAuthUser(profile: any, roles: UserRole[]): AuthUser {
  const roleNames = roles.map(r => r.role);
  const isFounder = roleNames.includes('founder');
  const isCoFounder = roleNames.includes('co-founder');
  const isAdmin = roleNames.some(r => ['founder','co-founder','admin'].includes(r));
  const isHost = roleNames.some(r => ['founder','co-founder','admin','coach'].includes(r));

  const adminRole = roles.find(r => ['founder','co-founder','admin','coach','assistant','attendance_reviewer'].includes(r.role));
  const executiveRole = isFounder ? 'Founder' : isCoFounder ? 'Co-Founder' : null;
  const displayTitle = adminRole?.title || (isFounder ? 'Founder & CEO' : isCoFounder ? 'Co-Founder' : null);

  // Parse permissions - can be jsonb array or string array
  let permissions: string[] = [];
  if (adminRole?.permissions) {
    if (Array.isArray(adminRole.permissions)) {
      permissions = adminRole.permissions as string[];
    } else if (typeof adminRole.permissions === 'string') {
      try {
        permissions = JSON.parse(adminRole.permissions);
      } catch {
        permissions = [];
      }
    } else {
      // jsonb
      permissions = adminRole.permissions as any;
    }
  }

  return {
    id: profile.id,
    kr8_id: profile.kr8_id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    phone_normalized: profile.phone_normalized || normalizePhone(profile.phone),
    country: profile.country,
    countryCode: profile.country || 'NG',
    skill: profile.skill,
    avatar: profile.avatar,
    bio: profile.bio,
    cover_photo: profile.cover_photo,
    points: profile.points || 0,
    attendance_accepted: profile.attendance_accepted || 0,
    submissions: profile.submissions || 0,
    referrals: profile.referrals || 0,
    graduated: !!profile.graduated,
    cert_tier: profile.cert_tier,
    cert_recognition: profile.cert_recognition,
    joined: profile.joined,
    roles,
    isAdmin,
    isHost,
    isFounder,
    isCoFounder,
    type: isFounder ? 'founder' : isCoFounder ? 'co-founder' : (roleNames.includes('tribe') ? 'tribe' : 'student'),
    ...(executiveRole ? { executiveRole } : {}),
    ...(displayTitle ? { title: displayTitle } : {}),
    ...(adminRole ? {
      admin: {
        role: (adminRole.role === 'founder' || adminRole.role === 'co-founder' ? 'ultimate' : adminRole.role as any),
        ...(adminRole.title ? { title: adminRole.title } : {}),
        permissions,
      },
    } : {}),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchProfile = async (userId: string): Promise<AuthUser | null> => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('Profile fetch error:', profileError.message);
        return null;
      }

      if (!profile) return null;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      if (rolesError) {
        console.warn('Roles fetch error:', rolesError.message);
      }

      return mapProfileToAuthUser(profile, (roles as any) || []);
    } catch (err) {
      console.error('fetchProfile error:', err);
      return null;
    }
  };

  const loadDbNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,text,link,read,created_at")
        .eq("user_id", userId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      const dbNotifications = (data ?? []).map((notification) => ({
        id: notification.id,
        text: notification.text,
        ts: notification.created_at ? Date.parse(notification.created_at) : Date.now(),
        link: notification.link,
        read: notification.read ?? false,
      }));
      setNotifications((previous) => {
        const dbIds = new Set(dbNotifications.map((notification) => notification.id));
        return [...dbNotifications, ...previous.filter((notification) => !dbIds.has(notification.id))].slice(0, 20);
      });
    } catch (error) {
      console.warn("Unable to load account notifications", error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let activeRealtimeUserId: string | null = null;
    let profileChannel: any = null;
    let notificationsChannel: any = null;

    const clearRealtime = () => {
      if (profileChannel) void supabase.removeChannel(profileChannel);
      if (notificationsChannel) void supabase.removeChannel(notificationsChannel);
      profileChannel = null;
      notificationsChannel = null;
      activeRealtimeUserId = null;
    };

    const setupRealtimeForUser = (userId: string) => {
      if (activeRealtimeUserId === userId) return;
      clearRealtime();
      activeRealtimeUserId = userId;

      profileChannel = supabase
        .channel(`profile-${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        }, async () => {
          const profile = await fetchProfile(userId);
          if (mounted) setUser(profile);
        })
        .subscribe();

      notificationsChannel = supabase
        .channel(`notifications-${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          if (!mounted) return;
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string } | null)?.id;
            if (deletedId) setNotifications((previous) => previous.filter((notification) => notification.id !== deletedId));
            return;
          }

          const row = payload.new as { id?: string; text?: string; link?: string | null; read?: boolean | null; created_at?: string | null };
          const notificationId = row.id;
          if (!notificationId) return;
          setNotifications((previous) => {
            if (row.read) return previous.filter((notification) => notification.id !== notificationId);
            const notification: Notification = {
              id: notificationId,
              text: row.text || "You have a new notification.",
              ts: row.created_at ? Date.parse(row.created_at) : Date.now(),
              link: row.link || null,
              read: false,
            };
            return [notification, ...previous.filter((item) => item.id !== notification.id)].slice(0, 20);
          });
        })
        .subscribe();
    };

    const init = async () => {
      try {
        // Load notifications from localStorage for compatibility
        try {
          const n = localStorage.getItem('kr8_notifs');
          if (n) setNotifications(JSON.parse(n));
        } catch {}

        // Device token
        try {
          let token = localStorage.getItem('kr8_device_session_token_v1');
          if (!token) {
            token = 'dev_' + Math.random().toString(36).substring(2) + '_' + Date.now().toString(36);
            localStorage.setItem('kr8_device_session_token_v1', token);
          }
          if (mounted) setDeviceToken(token);
        } catch {
          if (mounted) setDeviceToken('dev_fallback');
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (initialSession?.user) {
          setupRealtimeForUser(initialSession.user.id);
          setSession(initialSession);
          setSupabaseUser(initialSession.user);
          const profile = await fetchProfile(initialSession.user.id);
          if (mounted) setUser(profile);
          await loadDbNotifications(initialSession.user.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setSupabaseUser(newSession?.user || null);

      if (newSession?.user) {
        setupRealtimeForUser(newSession.user.id);
        const profile = await fetchProfile(newSession.user.id);
        setUser(profile);
        void loadDbNotifications(newSession.user.id);

        if (event === 'SIGNED_IN') {
          try {
            await supabase.from('activity_log').insert({
              actor_id: newSession.user.id,
              action: 'sign_in',
              details: { method: 'supabase_auth' },
            });
          } catch {}
        }
      } else {
        clearRealtime();
        setUser(null);
        setNotifications([]);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearRealtime();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data.user) {
        const profile = await fetchProfile(data.user.id);
        if (profile) {
          setUser(profile);
          return { ok: true, user: profile };
        }
        return { ok: true };
      }

      return { ok: false, error: 'Sign in failed' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Sign in failed' };
    }
  };

  const signUp = async (input: { name: string; email: string; phone: string; password: string; country?: string; skill?: string; dob?: string }) => {
    try {
      const cleanEmail = input.email.trim().toLowerCase();
      const normalizedPhone = normalizePhone(input.phone);

      const signUpOptions: any = {
        data: {
          name: input.name.trim(),
          phone: input.phone,
          phone_normalized: normalizedPhone,
          country: input.country || 'NG',
          skill: input.skill || 'graphic',
          dob: input.dob || '',
        },
      };
      if (typeof window !== 'undefined') {
        signUpOptions.emailRedirectTo = `${window.location.origin}/auth/confirmed`;
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: input.password,
        options: signUpOptions
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data.user) {
        await new Promise(r => setTimeout(r, 800));
        const profile = await fetchProfile(data.user.id);
        if (profile) {
          setUser(profile);
          return { ok: true, user: profile, kr8_id: profile.kr8_id, message: `Account created! Your KR8 ID is ${profile.kr8_id}. Please check email to verify.` };
        }
        return { ok: true, message: 'Account created! Please check email to verify, then sign in.', kr8_id: undefined } as any;
      }

      return { ok: false, error: 'Sign up failed' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Sign up failed' };
    }
  };

  const signOut = async () => {
    try {
      if (user) {
        try {
          await supabase.from('activity_log').insert({
            actor_id: user.id,
            action: 'sign_out',
          });
        } catch {}
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setSupabaseUser(null);
      try {
        localStorage.removeItem('kr8_current');
        window.dispatchEvent(new CustomEvent('kr8:auth-logout'));
      } catch {}
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const resetOptions: any = {};
      if (typeof window !== 'undefined') {
        resetOptions.redirectTo = `${window.location.origin}/reset-password`;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, resetOptions);

      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Password reset failed' };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true, message: 'Password updated successfully' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Password update failed' };
    }
  };

  const refreshProfile = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      const profile = await fetchProfile(currentSession.user.id);
      setUser(profile);
    }
  };

  const addNotification = (text: string) => {
    setNotifications(prev => {
      const next = [{ id: Math.random().toString(36).slice(2), text, ts: Date.now(), read: false }, ...prev].slice(0, 20);
      try {
        localStorage.setItem('kr8_notifs', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    try {
      localStorage.removeItem('kr8_notifs');
    } catch {}
    if (user?.id) {
      void supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .then(({ error }) => {
          if (error) console.warn("Unable to mark notifications as read", error.message);
        });
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        student: user,
        session,
        supabaseUser,
        loading,
        deviceSessionToken: deviceToken,
        notifications,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
        addNotification,
        clearNotifications,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { ADMIN_SECTIONS, MAIN_ADMIN_PASSWORD } from "../data/store";

export type UserRole =
  | "student"
  | "tribe"
  | "coach"
  | "assistant"
  | "admin"
  | "co-founder"
  | "founder"
  | "attendance_reviewer"
  | "moderator";

export type AuthProfile = {
  id: string; // UUID from auth.users
  kr8_id: string; // Public KR8 ID e.g. KR82026JD0001GDVFD
  name: string;
  email: string;
  phone: string;
  country: string;
  skill: string;
  dob?: string | null;
  cohort_year: number;
  serial: number;
  avatar?: string | null;
  bio?: string | null;
  cover_photo?: string | null;
  points: number;
  attendance_accepted: number;
  submissions: number;
  referrals: number;
  graduated: boolean;
  cert_tier?: "Completion" | "Professionalism" | null;
  cert_recognition?: string | null;
  verify_remark?: string | null;
  message_privacy: "Anyone" | "Friends only" | "No one";
  expanded_visibility: boolean;
  vip: boolean;
  restricted: boolean;
  whatsapp_joined?: boolean;
  whatsapp_joined_at?: string | null;
  onboarding_skipped?: boolean;
  created_at: string;
};

export type AuthUser = {
  // Supabase Auth
  authId: string;
  email: string;
  emailConfirmed: boolean;

  // Profile (backward compatible with old Account shape)
  id: string; // KR8 ID for backward compat with components expecting student.id = KR8 ID
  userId: string; // UUID for DB operations
  kr8_id: string;
  name: string;
  phone: string;
  country: string;
  skill: string;
  dob?: string;
  year: number;
  serial: number;
  avatar: string;
  bio?: string;
  coverPhoto?: string;
  points: number;
  attendanceAccepted: number;
  submissions: number;
  referrals: number;
  graduated: boolean;
  certTier?: "Completion" | "Professionalism" | null;
  certRecognition?: string;
  verifyRemark?: string;
  messagePrivacy: "Anyone" | "Friends only" | "No one";
  expandedVisibility: boolean;
  vip: boolean;
  restricted: boolean;
  joined: number;

  // Onboarding state
  whatsappJoined: boolean;
  onboardingSkipped: boolean;

  // Roles from user_roles table
  roles: UserRole[];
  permissions: string[];
  type: "student" | "tribe" | "founder" | "co-founder";
  executiveRole?: "Founder" | "Co-Founder";
  title?: string;
  isAdmin: boolean;
  isFounder: boolean;
  isCoFounder: boolean;
  isCoach: boolean;
  isModerator: boolean;

  // Legacy admin object compatibility for components checking student.admin
  admin?: {
    role: "ultimate" | "admin" | "coach" | "assistant" | "attendance_reviewer";
    title?: string;
    permissions: string[];
    adminPassword?: string;
    passwordNotice?: string;
  };

  // Multi-skill from enrollments
  skills: string[];
  graduatedSkills: string[];
  multiSkillCount: number;

  // Compat fields
  portfolio: any[];
  following: string[];
  followers: string[];
  notifications: any[];
  certificates: any[];
};

type AuthContextValue = {
  user: AuthUser | null;
  student: AuthUser | null; // Alias for backward compatibility
  session: Session | null;
  loading: boolean;
  notifications: any[];
  unreadCount: number;
  whatsappReminderPending: boolean;
  signUp: (input: {
    name: string;
    email: string;
    phone: string;
    country?: string;
    skill: string;
    dob?: string;
    password: string;
    mode?: "student" | "tribe";
  }) => Promise<{ ok: boolean; error?: string; needsEmailConfirm?: boolean; kr8Id?: string }>;
  signIn: (
    emailOrIdentifierOrAccount: string | any,
    password?: string
  ) => Promise<{ ok: boolean; error?: string; code?: string; email?: string; needsWhatsappReminder?: boolean }>;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  markWhatsAppOnboarding: (joined: boolean, skipped?: boolean) => Promise<void>;
  dismissWhatsappReminderForSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const FOUNDER_EMAILS_SET = new Set(["kr8digitals01@gmail.com", "kutimfire001@gmail.com"]);
const FOUNDER_PHONES_SET = new Set(["2348125687509", "2348166552758", "+2348125687509", "+2348166552758"]);
const COFOUNDER_PHONES_SET = new Set(["2348089344434", "2348106068523", "+2348089344434", "+2348106068523"]);

function setAuthCookies(accessToken?: string | null, execEmail?: string | null) {
  if (typeof document === "undefined") return;
  try {
    if (accessToken) {
      document.cookie = `kr8_sb_token=${encodeURIComponent(accessToken)}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = `kr8_sb_token=; path=/; max-age=0; SameSite=Lax`;
    }
    if (execEmail) {
      document.cookie = `kr8_exec_email=${encodeURIComponent(execEmail)}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = `kr8_exec_email=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch {}
}

function getLocalWhatsAppState(userId: string, kr8Id?: string): { joined?: boolean; skipped?: boolean } {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      localStorage.getItem(`kr8_wa_onboard_${userId}`) ||
      (kr8Id ? localStorage.getItem(`kr8_wa_onboard_${kr8Id}`) : null);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalWhatsAppState(userId: string, kr8Id: string | undefined, state: { joined: boolean; skipped: boolean }) {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(state);
    if (userId) localStorage.setItem(`kr8_wa_onboard_${userId}`, json);
    if (kr8Id) localStorage.setItem(`kr8_wa_onboard_${kr8Id}`, json);
  } catch {}
}

function defaultAvatar(name: string, id: string): string {
  const cleanName = (name || "Creator").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : cleanName.slice(0, 2).toUpperCase();
  const palettes = [
    { c1: "#ec4899", c2: "#8b5cf6" },
    { c1: "#06b6d4", c2: "#3b82f6" },
    { c1: "#f59e0b", c2: "#f43f5e" },
    { c1: "#10b981", c2: "#0d9488" },
  ];
  const seed = (cleanName + id).split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const p = palettes[Math.abs(seed) % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${p.c1}"/><stop offset="100%" stop-color="${p.c2}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><text x="60" y="66" fill="#fff" font-family="sans-serif" font-size="44" font-weight="700" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function fetchFullUserProfile(authUser: User): Promise<AuthUser | null> {
  try {
    // 1. Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profErr) {
      console.error("[Auth] Error fetching profile:", profErr.message);
    }

    if (!profile) {
      await new Promise((r) => setTimeout(r, 500));
      const { data: retryProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      if (!retryProfile) return null;
      return buildAuthUser(authUser, retryProfile as any);
    }

    return buildAuthUser(authUser, profile as any);
  } catch (err) {
    console.error("[Auth] fetchFullUserProfile exception:", err);
    return null;
  }
}

async function buildAuthUser(authUser: User, profile: AuthProfile): Promise<AuthUser> {
  const emailLower = (profile.email || authUser.email || "").trim().toLowerCase();
  const phoneClean = (profile.phone || "").replace(/[^0-9]/g, "");
  const isRecognizedFounder =
    FOUNDER_EMAILS_SET.has(emailLower) ||
    FOUNDER_PHONES_SET.has(phoneClean) ||
    FOUNDER_PHONES_SET.has(profile.phone || "");
  const isRecognizedCoFounder =
    !isRecognizedFounder &&
    (COFOUNDER_PHONES_SET.has(phoneClean) || COFOUNDER_PHONES_SET.has(profile.phone || ""));

  // If recognized Founder or Co-Founder, ensure user_roles in Supabase is synced via server function
  if (isRecognizedFounder || isRecognizedCoFounder) {
    try {
      const { syncExecutiveUserRoles } = await import("@/lib/auth.functions");
      await syncExecutiveUserRoles({
        data: {
          userId: authUser.id,
          email: emailLower,
          phone: profile.phone || "",
        },
      });
    } catch {}
  }

  // Fetch roles from user_roles table
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role, title, permissions")
    .eq("user_id", authUser.id);

  const roles: UserRole[] = (roleRows || []).map((r: any) => r.role as UserRole);
  if (isRecognizedFounder && !roles.includes("founder")) roles.push("founder");
  if (isRecognizedCoFounder && !roles.includes("co-founder")) roles.push("co-founder");
  if (roles.length === 0) roles.push("student");

  const permissionsSet = new Set<string>();
  let title: string | undefined;
  (roleRows || []).forEach((r: any) => {
    if (r.title && !title) title = r.title;
    if (Array.isArray(r.permissions)) {
      r.permissions.forEach((p: string) => permissionsSet.add(p));
    }
  });

  // Fetch enrollments
  const { data: enrollmentRows } = await supabase
    .from("enrollments")
    .select("skill_key, graduated")
    .eq("user_id", authUser.id);

  const skills = (enrollmentRows || []).map((e: any) => e.skill_key);
  if (skills.length === 0 && profile.skill) skills.push(profile.skill);
  const graduatedSkills = (enrollmentRows || [])
    .filter((e: any) => e.graduated)
    .map((e: any) => e.skill_key);

  // Fetch active certificates
  let certificates: any[] = [];
  try {
    const { data: certRows } = await supabase
      .from("certificates")
      .select("*")
      .or(`student_id.eq.${authUser.id},kr8_id.eq.${profile.kr8_id}`)
      .eq("status", "active");
    certificates = certRows || [];
  } catch {}

  const isFounder = isRecognizedFounder || roles.includes("founder");
  const isCoFounder = !isFounder && (isRecognizedCoFounder || roles.includes("co-founder"));
  const isAdmin = isFounder || isCoFounder || roles.includes("admin");
  const isCoach = isAdmin || roles.includes("coach") || roles.includes("attendance_reviewer");
  const isModerator = isAdmin || roles.includes("moderator");

  let type: "student" | "tribe" | "founder" | "co-founder" = "student";
  if (isFounder) type = "founder";
  else if (isCoFounder) type = "co-founder";
  else if (roles.includes("tribe") && !roles.includes("student")) type = "tribe";

  if (isFounder || isCoFounder || isAdmin) {
    ADMIN_SECTIONS.forEach((sec) => permissionsSet.add(sec));
    [
      "all",
      "view_students",
      "issue_certificates",
      "review_attendance",
      "manage_content",
      "manage_live",
      "moderation",
      "manage_links",
      "view_finance",
      "manage_roles",
    ].forEach((p) => permissionsSet.add(p));
  }

  // Determine WhatsApp onboarding state from profile, user_metadata, and localStorage
  const meta = authUser.user_metadata || {};
  const localWa = getLocalWhatsAppState(authUser.id, profile.kr8_id);
  const whatsappJoined = Boolean(
    isFounder ||
      isCoFounder ||
      profile.graduated ||
      certificates.length > 0 ||
      (profile as any).whatsapp_joined === true ||
      meta.whatsapp_joined === true ||
      localWa.joined === true
  );
  const onboardingSkipped = Boolean(
    !whatsappJoined &&
      ((profile as any).onboarding_skipped === true ||
        meta.onboarding_skipped === true ||
        localWa.skipped === true)
  );

  const isGraduated = Boolean(profile.graduated || certificates.length > 0 || isFounder || isCoFounder);

  return {
    authId: authUser.id,
    userId: authUser.id,
    email: profile.email || authUser.email || "",
    emailConfirmed: !!authUser.email_confirmed_at || isFounder || isCoFounder,

    id: profile.kr8_id,
    kr8_id: profile.kr8_id,
    name: profile.name,
    phone: profile.phone || "",
    country: profile.country || "NG",
    skill: profile.skill || "graphic",
    dob: profile.dob || undefined,
    year: profile.cohort_year || 2026,
    serial: profile.serial || 1,
    avatar:
      profile.avatar ||
      (isFounder
        ? "/founder_timfire.jpg"
        : defaultAvatar(profile.name, profile.kr8_id)),
    bio: profile.bio || undefined,
    coverPhoto: profile.cover_photo || undefined,
    points: profile.points || 0,
    attendanceAccepted: profile.attendance_accepted || 0,
    submissions: profile.submissions || 0,
    referrals: profile.referrals || 0,
    graduated: isGraduated,
    certTier:
      profile.cert_tier ||
      (certificates[0]?.tier as any) ||
      (isGraduated ? "Professionalism" : null),
    certRecognition:
      profile.cert_recognition || certificates[0]?.additional_notes || undefined,
    verifyRemark: profile.verify_remark || undefined,
    messagePrivacy: profile.message_privacy || "Anyone",
    expandedVisibility: profile.expanded_visibility || false,
    vip: profile.vip || isFounder || isCoFounder,
    restricted: profile.restricted || false,
    joined: new Date(profile.created_at || Date.now()).getTime(),

    whatsappJoined,
    onboardingSkipped,

    roles,
    permissions: Array.from(permissionsSet),
    type,
    executiveRole: isFounder ? "Founder" : isCoFounder ? "Co-Founder" : undefined,
    title:
      title ||
      (isFounder ? "Founder & CEO" : isCoFounder ? "Co-Founder" : undefined),
    isAdmin,
    isFounder,
    isCoFounder,
    isCoach,
    isModerator,

    admin:
      isFounder || isCoFounder || isAdmin || isCoach
        ? {
            role: isFounder || isCoFounder ? "ultimate" : isAdmin ? "admin" : "coach",
            title:
              title ||
              (isFounder
                ? "Founder & CEO"
                : isCoFounder
                ? "Co-Founder"
                : "Administrator"),
            permissions: Array.from(permissionsSet),
            adminPassword: MAIN_ADMIN_PASSWORD,
          }
        : undefined,

    skills,
    graduatedSkills,
    multiSkillCount: skills.length,

    portfolio: [],
    following: [],
    followers: [],
    notifications: [],
    certificates,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reminderDismissedSession, setReminderDismissedSession] = useState(false);

  const loadNotifications = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) setNotifications(data);
    } catch {}
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      setUser(null);
      return;
    }
    const fullUser = await fetchFullUserProfile(authUser);
    setUser(fullUser);
    if (fullUser) {
      setAuthCookies(
        session?.access_token || null,
        fullUser.isFounder || fullUser.isCoFounder ? fullUser.email : null
      );
      await loadNotifications(authUser.id);
    }
  }, [loadNotifications, session?.access_token]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthCookies(newSession?.access_token || null, newSession?.user?.email || null);
      if (newSession?.user) {
        setTimeout(async () => {
          const fullUser = await fetchFullUserProfile(newSession.user);
          setUser(fullUser);
          setLoading(false);
          if (fullUser) {
            setAuthCookies(
              newSession.access_token,
              fullUser.isFounder || fullUser.isCoFounder ? fullUser.email : null
            );
            loadNotifications(newSession.user.id);
          }
        }, 0);
      } else {
        setUser(null);
        setNotifications([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      setSession(initSession);
      setAuthCookies(initSession?.access_token || null, initSession?.user?.email || null);
      if (initSession?.user) {
        const fullUser = await fetchFullUserProfile(initSession.user);
        setUser(fullUser);
        if (fullUser) {
          setAuthCookies(
            initSession.access_token,
            fullUser.isFounder || fullUser.isCoFounder ? fullUser.email : null
          );
          loadNotifications(initSession.user.id);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadNotifications]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user?.authId) return;
    const channel = supabase
      .channel(`notif-${user.authId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.authId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as any, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.authId]);

  const signUp: AuthContextValue["signUp"] = async (input) => {
    try {
      const email = input.email.trim().toLowerCase();
      const phone = input.phone.trim();
      const name = input.name.trim();
      const skill = input.mode === "tribe" ? "tribe" : input.skill || "graphic";

      if (input.password.length < 6) {
        return { ok: false, error: "Password must be at least 6 characters." };
      }

      const siteOrigin = typeof window !== "undefined" ? window.location.origin : "https://www.kr8digitals.com";

      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/confirmed`,
          data: {
            name,
            phone,
            country: input.country || "NG",
            skill: input.skill || "graphic",
            dob: input.dob || null,
            mode: input.mode || "student",
            whatsapp_joined: false,
            onboarding_skipped: false,
          },
        },
      });

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("already exists")
        ) {
          return {
            ok: false,
            error: "An account with this email already exists. Please sign in instead.",
          };
        }
        return { ok: false, error: error.message };
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return {
          ok: false,
          error: "An account with this email already exists. Please sign in instead.",
        };
      }

      // Send engaging custom confirmation email via Resend in addition to Supabase Auth
      try {
        const { sendRegistrationConfirmationEmail } = await import("@/lib/welcome.functions");
        await sendRegistrationConfirmationEmail({
          data: {
            email,
            name,
            skillKey: skill,
            mode: input.mode || "student",
            siteOrigin,
          },
        });
      } catch (e) {
        console.warn("[Auth] Custom confirmation email non-fatal warning:", e);
      }

      return { ok: true, needsEmailConfirm: true };
    } catch (err: any) {
      return { ok: false, error: err.message || "Registration failed" };
    }
  };

  const signIn: AuthContextValue["signIn"] = async (emailOrIdentifierOrAccount, password) => {
    try {
      // Backward compatibility if a component passes an Account object directly
      if (
        emailOrIdentifierOrAccount &&
        typeof emailOrIdentifierOrAccount === "object" &&
        !password
      ) {
        const acc = emailOrIdentifierOrAccount;
        const isFounder =
          acc.type === "founder" ||
          acc.executiveRole === "Founder" ||
          FOUNDER_EMAILS_SET.has((acc.email || "").toLowerCase());
        const isCoFounder =
          !isFounder && (acc.type === "co-founder" || acc.executiveRole === "Co-Founder");
        const mapped: AuthUser = {
          authId: acc.userId || acc.id,
          userId: acc.userId || acc.id,
          email: acc.email || "",
          emailConfirmed: true,
          id: acc.id,
          kr8_id: acc.kr8_id || acc.id,
          name: acc.name || "KR8 Creator",
          phone: acc.phone || "",
          country: acc.country || "NG",
          skill: acc.skill || "graphic",
          dob: acc.dob,
          year: acc.year || 2026,
          serial: acc.serial || 1,
          avatar: acc.avatar || defaultAvatar(acc.name || "KR8", acc.id || ""),
          bio: acc.bio,
          coverPhoto: acc.coverPhoto,
          points: acc.points || 0,
          attendanceAccepted: acc.attendanceAccepted || 0,
          submissions: acc.submissions || 0,
          referrals: acc.referrals || 0,
          graduated: !!acc.graduated,
          certTier: acc.certTier || null,
          certRecognition: acc.certRecognition,
          verifyRemark: acc.verifyRemark,
          messagePrivacy: acc.messagePrivacy || "Anyone",
          expandedVisibility: !!acc.expandedVisibility,
          vip: !!acc.vip || isFounder || isCoFounder,
          restricted: !!acc.restricted,
          joined: acc.joined || Date.now(),
          whatsappJoined: true,
          onboardingSkipped: false,
          roles: isFounder ? ["founder"] : isCoFounder ? ["co-founder"] : ["student"],
          permissions: isFounder || isCoFounder ? [...ADMIN_SECTIONS, "all"] : [],
          type: isFounder ? "founder" : isCoFounder ? "co-founder" : acc.type || "student",
          executiveRole: isFounder ? "Founder" : isCoFounder ? "Co-Founder" : undefined,
          title: acc.title || (isFounder ? "Founder & CEO" : isCoFounder ? "Co-Founder" : undefined),
          isAdmin: isFounder || isCoFounder || !!acc.admin,
          isFounder,
          isCoFounder,
          isCoach: isFounder || isCoFounder || !!acc.admin,
          isModerator: isFounder || isCoFounder || !!acc.isModerator,
          admin: acc.admin,
          skills: acc.skills || [acc.skill || "graphic"],
          graduatedSkills: acc.graduatedSkills || [],
          multiSkillCount: acc.multiSkillCount || 1,
          portfolio: acc.portfolio || [],
          following: acc.following || [],
          followers: acc.followers || [],
          notifications: acc.notifications || [],
          certificates: acc.certificates || [],
        };
        setUser(mapped);
        if (isFounder || isCoFounder) {
          setAuthCookies(null, mapped.email || "kr8digitals01@gmail.com");
        }
        return { ok: true };
      }

      const identifier = String(emailOrIdentifierOrAccount || "").trim();
      const pwd = String(password || "");
      if (!identifier || !pwd) {
        return { ok: false, error: "Please enter your Email / KR8 ID / Phone and password." };
      }

      // 1. Try server-side signInWithKr8Id (resolves Email, KR8 ID, Phone, AND Founder/Co-Founder accounts)
      try {
        const { signInWithKr8Id } = await import("@/lib/auth.functions");
        const serverRes: any = await signInWithKr8Id({
          data: { identifier, password: pwd },
        });

        if (serverRes?.ok && serverRes?.session) {
          const { data: setSessData } = await supabase.auth.setSession({
            access_token: serverRes.session.access_token,
            refresh_token: serverRes.session.refresh_token,
          });
          setAuthCookies(serverRes.session.access_token, serverRes.session.user?.email || null);

          const activeAuthUser = setSessData?.user || serverRes.session.user;
          if (activeAuthUser) {
            const fullUser = await fetchFullUserProfile(activeAuthUser);
            setUser(fullUser);
            setReminderDismissedSession(false);
            const needsWhatsappReminder = Boolean(
              fullUser &&
                !fullUser.isFounder &&
                !fullUser.isCoFounder &&
                !fullUser.graduated &&
                !fullUser.whatsappJoined
            );
            return { ok: true, needsWhatsappReminder };
          }
          return { ok: true };
        }

        if (serverRes && !serverRes.ok && serverRes.code === "EMAIL_NOT_CONFIRMED") {
          return {
            ok: false,
            code: "EMAIL_NOT_CONFIRMED",
            email: serverRes.email || (identifier.includes("@") ? identifier : undefined),
            error: serverRes.error,
          };
        }
      } catch (serverErr) {
        console.warn("[Auth] signInWithKr8Id fallback to client signInWithPassword:", serverErr);
      }

      // 2. Fallback: direct client-side signInWithPassword if identifier is an email
      if (identifier.includes("@")) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier.toLowerCase(),
          password: pwd,
        });

        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            return {
              ok: false,
              code: "EMAIL_NOT_CONFIRMED",
              email: identifier.toLowerCase(),
              error:
                "Please confirm your email address first! Check your inbox (and Spam/Promotions folder) for the confirmation email from KR8 Digitals.",
            };
          }
          return { ok: false, error: "Invalid email or password. Please check your credentials." };
        }

        if (data.user && data.session) {
          setAuthCookies(data.session.access_token, data.user.email || null);
          const fullUser = await fetchFullUserProfile(data.user);
          setUser(fullUser);
          setReminderDismissedSession(false);
          const needsWhatsappReminder = Boolean(
            fullUser &&
              !fullUser.isFounder &&
              !fullUser.isCoFounder &&
              !fullUser.graduated &&
              !fullUser.whatsappJoined
          );
          return { ok: true, needsWhatsappReminder };
        }
      }

      return {
        ok: false,
        error: "Invalid credentials. Please check your Email / KR8 ID / Phone and password.",
      };
    } catch (err: any) {
      return { ok: false, error: err.message || "Sign in failed" };
    }
  };

  const signInWithGoogle: AuthContextValue["signInWithGoogle"] = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || "Google sign-in failed" };
    }
  };

  const signOut = async () => {
    setAuthCookies(null, null);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setNotifications([]);
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = async () => {
    if (!user?.authId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.authId)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markWhatsAppOnboarding = async (joined: boolean, skipped = false) => {
    if (!user) return;
    saveLocalWhatsAppState(user.authId, user.kr8_id, { joined, skipped });
    setUser((prev) =>
      prev
        ? {
            ...prev,
            whatsappJoined: joined,
            onboardingSkipped: skipped,
          }
        : null
    );
    if (joined) {
      setReminderDismissedSession(true);
    }
    try {
      const { recordStudentOnboardingStatus } = await import("@/lib/public-data.functions");
      await recordStudentOnboardingStatus({
        data: {
          userId: user.authId,
          whatsappJoined: joined,
          onboardingSkipped: skipped,
        },
      });
    } catch {}
  };

  const dismissWhatsappReminderForSession = () => {
    setReminderDismissedSession(true);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const whatsappReminderPending = Boolean(
    user &&
      !user.isFounder &&
      !user.isCoFounder &&
      !user.graduated &&
      !user.whatsappJoined &&
      !reminderDismissedSession
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        student: user,
        session,
        loading,
        notifications,
        unreadCount,
        whatsappReminderPending,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshProfile,
        markNotificationRead,
        markAllNotificationsRead,
        markWhatsAppOnboarding,
        dismissWhatsappReminderForSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

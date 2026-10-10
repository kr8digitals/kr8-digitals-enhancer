// Production store - DB-first, safe defaults, no hardcoded founder checks
// All role decisions come from user_roles table via AuthContext
// No phone/email hardcoded role logic in client
import { IMG } from "./images";
import { supabase } from "@/integrations/supabase/client";

export type Week = { week: string; title: string; points: string[] };
export type Skill = { key: string; name: string; suffix: string; whatsapp: string; available: boolean; regOpen: boolean; snippet: string; icon: string; instructor: { name: string; photo: string; bio: string } | null; curriculum: Week[]; criteria: string; };

export const INSTRUCTOR_PHOTOS = {
  stevenson: "/team/nicodemus.png",
  chimnonyerem: "/team/chimnonyerem.jpg",
  timfire: "/founder_timfire_wide.jpg",
  daniel: "/team/covenant.png",
};

export type FounderProfile = { key: string; name: string; role: string; bio: string; photo: string; };
export type TeamProfile = FounderProfile;
const DEFAULT_FOUNDERS: FounderProfile[] = [
  { key: "timfire", name: "Timfire (Kenneth Timothy Iziogo)", role: "CEO · Founder · Website Development", bio: "Founder, AI agent developer.", photo: INSTRUCTOR_PHOTOS.timfire },
  { key: "stevenson", name: "Stevenson (Motionverse)", role: "Co-Founder · Media Director", bio: "Leads Graphic Design.", photo: INSTRUCTOR_PHOTOS.stevenson },
  { key: "daniel", name: "Daniel (Creative Expression)", role: "Co-Founder · COO", bio: "Leads Video Editing.", photo: INSTRUCTOR_PHOTOS.daniel },
];
export function getFounders(): FounderProfile[] { return DEFAULT_FOUNDERS; }
export function saveFounders(_f: FounderProfile[]) {}

const DEFAULT_TEAM: TeamProfile[] = [
  { key: "nicodemus", name: "Odobe Nicodemus C (BioNicz)", role: "KR8 Financial Strategist", bio: "Financial strategy.", photo: "/team/nicodemus.png" },
  { key: "chimnonyerem", name: "Chimnonyerem Mercy", role: "Project Director & Frontend Coach", bio: "Technical initiatives.", photo: "/team/chimnonyerem.jpg" },
  { key: "favour", name: "Nwefuru Favour Chizurum", role: "General Manager", bio: "Operations.", photo: "/team/favour.jpg" },
  { key: "covenant", name: "Covenant Afinidi", role: "Accountability Partner", bio: "Community momentum.", photo: "/team/covenant.png" },
];
export function getTeam(): TeamProfile[] { return DEFAULT_TEAM; }
export function saveTeam(_t: TeamProfile[]) {}

export const DEFAULT_SKILLS: Skill[] = [
  { key: "graphic", name: "Graphic Design", suffix: "GDVFD", whatsapp: "https://chat.whatsapp.com/G5mSP8JeelfELvnljpgSJ8", available: true, regOpen: true, snippet: "8-week graphic design.", icon: "palette", instructor: { name: "Stevenson (Motionverse)", photo: INSTRUCTOR_PHOTOS.stevenson, bio: "Leads Graphic Design." }, criteria: "Submit 6 assignments + final project.", curriculum: [] },
  { key: "video", name: "Video Editing & Animation", suffix: "VEVFD", whatsapp: "https://chat.whatsapp.com/GYVKMA6CLPC2mnG356u8jT", available: true, regOpen: true, snippet: "8-week video editing.", icon: "video", instructor: { name: "Daniel (Creative Expression)", photo: INSTRUCTOR_PHOTOS.daniel, bio: "Leads Video Editing." }, criteria: "Submit 6 edits + showreel.", curriculum: [] },
  { key: "web", name: "Website Development", suffix: "WDVFD", whatsapp: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v", available: true, regOpen: true, snippet: "8-week website development.", icon: "code", instructor: { name: "Timfire", photo: INSTRUCTOR_PHOTOS.timfire, bio: "Founder." }, criteria: "Submit 6 builds + deployed site.", curriculum: [] },
  { key: "frontend", name: "Front-End Development", suffix: "FEDVFD", whatsapp: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v", available: true, regOpen: true, snippet: "8-week frontend.", icon: "code", instructor: { name: "Nonye Mercy", photo: "/team/chimnonyerem.jpg", bio: "Frontend Coach." }, criteria: "6+ builds including React.", curriculum: [] },
  { key: "content_creation", name: "Content Creation", suffix: "CCVFD", whatsapp: "https://chat.whatsapp.com/KRnuYK0hIhh0lobi7Tl7Kz", available: true, regOpen: true, snippet: "8-week creator programme.", icon: "video", instructor: null, criteria: "6 pieces + calendar.", curriculum: [] },
  { key: "smm", name: "Social Media Management", suffix: "SMMVFD", whatsapp: "https://chat.whatsapp.com/KRnuYK0hIhh0lobi7Tl7Kz", available: true, regOpen: true, snippet: "8-week SMM.", icon: "mobile", instructor: null, criteria: "30-day calendar + audit.", curriculum: [] },
  { key: "marketing", name: "Digital Marketing", suffix: "DMVFD", whatsapp: "https://chat.whatsapp.com/Fah586y8c26KkUfRhAe8i6", available: true, regOpen: true, snippet: "8-week marketing.", icon: "chart", instructor: null, criteria: "6 assignments + campaign.", curriculum: [] },
];

export const FULL_CURRICULA: Record<string, Week[]> = {
  graphic: [{ week: "Week 1", title: "Design Basics", points: ["Intro"] }],
  web: [{ week: "Week 1", title: "Intro", points: ["What a website is"] }],
  video: [{ week: "Week 1", title: "Intro", points: ["Terminology"] }],
};

export const CERTIFICATION_CRITERIA: Record<string, string> = {
  graphic: "≥80% attendance",
  web: "≥80% attendance",
};

// Helper to ensure array
function safeArray<T>(v: any, fallback: T[] = []): T[] {
  return Array.isArray(v) ? v : fallback;
}
function safeRecord(v: any, fallback: Record<string, any> = {}): Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback;
}

export function getSkills(): Skill[] {
  try {
    // Try DB cache if available
    const mod = require("./skillsStore");
    if (mod && typeof mod.getSkillsFromCache === 'function') {
      const cached = mod.getSkillsFromCache();
      if (Array.isArray(cached) && cached.length > 0) return cached as Skill[];
    }
    if (mod && typeof mod.getSkillSettingsSync === 'function') {
      const db = mod.getSkillSettingsSync();
      if (Array.isArray(db) && db.length > 0) {
        return db.map((s: any) => ({
          key: s.skill_key,
          name: s.name,
          suffix: s.suffix || s.skill_key.toUpperCase().slice(0,3)+'VFD',
          whatsapp: s.whatsapp_url || DEFAULT_SKILLS.find(d=>d.key===s.skill_key)?.whatsapp || "",
          available: !!s.available,
          regOpen: !!s.reg_open,
          snippet: s.snippet || "",
          icon: s.icon || "code",
          instructor: null,
          curriculum: [],
          criteria: "",
        }));
      }
    }
  } catch {}
  return DEFAULT_SKILLS;
}
export const SKILLS: Skill[] = DEFAULT_SKILLS;

export function getSkill(key?: string): Skill | undefined {
  if (!key) return undefined;
  try {
    const k = key.trim().toLowerCase();
    const all = safeArray(getSkills(), DEFAULT_SKILLS);
    const direct = all.find(s => s.key.toLowerCase() === k);
    if (direct) return direct;
    if (k === "content") return all.find(s => s.key === "content_creation");
    if (k.includes("graphic")) return all.find(s => s.key === "graphic");
    if (k.includes("video")) return all.find(s => s.key === "video");
    if (k.includes("web")) return all.find(s => s.key === "web");
    return all.find(s => s.key.toLowerCase().includes(k) || s.name.toLowerCase().includes(k));
  } catch {
    return undefined;
  }
}
export function getSkillName(key?: string): string { 
  try {
    const s = getSkill(key); 
    return s?.name ?? key ?? "Digital Skills"; 
  } catch {
    return key ?? "Digital Skills";
  }
}
export function getSkillRegistration(_key: string): boolean { 
  try {
    const s = getSkill(_key);
    return s ? !!s.regOpen : true;
  } catch { return true; }
}
export function getSkillWhatsApp(key: string): string { 
  try {
    const s = getSkill(key); 
    return s?.whatsapp ?? ""; 
  } catch { return ""; }
}

export function normalizePhone(value: string): string {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) return '234' + cleaned.substring(1);
  else if (cleaned.startsWith('234') && cleaned.length === 13) return cleaned;
  else if (cleaned.length === 10) return '234' + cleaned;
  return cleaned;
}
export function normalizeEmail(value: string): string { return value.trim().toLowerCase(); }
export function normalizeIdentity(value: string): string { return value.trim().replace(/[\s-]/g, "").toUpperCase(); }

import { ALL_COUNTRIES, findCountry } from "./countries";
export const COUNTRIES = ALL_COUNTRIES;
export function countryByCode(code: string) { return findCountry(code); }
export function buildPhone(dial: string, local: string): string { const clean = local.replace(/[^0-9]/g, "").replace(/^0+/, ""); return `${dial}${clean}`; }
export async function detectCountryCode(): Promise<string> { return "NG"; }

const AVATAR_PALETTES = [{ c1: "#ec4899", c2: "#8b5cf6" }, { c1: "#06b6d4", c2: "#3b82f6" }];
export function generateDefaultAvatar(name: string, id: string = ""): string {
  const cleanName = (name || "Creator").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : cleanName.slice(0, 2).toUpperCase();
  const seed = (cleanName + id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const palette = AVATAR_PALETTES[Math.abs(seed) % AVATAR_PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${palette.c1}"/><stop offset="100%" stop-color="${palette.c2}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#grad)"/><text x="60" y="66" fill="#ffffff" font-family="system-ui" font-size="44" font-weight="700" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type CertificateTier = "Professionalism" | "Completion";
export type Account = {
  type: "student" | "tribe" | "founder" | "co-founder";
  executiveRole?: "Founder" | "Co-Founder";
  title?: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  country?: string;
  skill?: string;
  dob?: string;
  year?: number;
  serial?: number;
  vip: boolean;
  points: number;
  attendanceAccepted: number;
  submissions: number;
  referrals: number;
  graduated: boolean;
  certTier?: "Completion" | "Professionalism" | null;
  certRecognition?: string;
  avatar: string;
  joined: number;
  isPlaceholder?: boolean;
  bio?: string;
  admin?: any;
};

export const CONTACT = { whatsapp: "+2348125687509", whatsappTeam: "https://wa.me/2348125687509", payment: { account: "8166552758", bank: "OPay", name: "Kenneth Timothy" }, email: "kr8digitals01@gmail.com", phone: "+234 812 568 7509" };
export const ADMIN_SECTIONS = ["Overview", "Student Management", "Attendance Review", "Graduation & Certificates", "Announcements", "Live Streams & Replays", "Leaderboard & XP", "Admin Permissions", "Skills & Links"];

let dbProfilesCache: Account[] = [];
let lastFetch = 0;
async function fetchDbProfiles(): Promise<Account[]> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('points', { ascending: false }).limit(500);
    if (error) { console.warn('fetchDbProfiles error:', error.message); return dbProfilesCache; }
    if (data) {
      dbProfilesCache = data.map((p: any) => ({
        type: 'student' as const,
        id: p.kr8_id, name: p.name, email: p.email, phone: p.phone || '', country: p.country || 'NG', skill: p.skill || 'graphic', dob: p.dob || '', year: 2026, serial: 1, vip: false, points: p.points || 0, attendanceAccepted: p.attendance_accepted || 0, submissions: p.submissions || 0, referrals: p.referrals || 0, graduated: !!p.graduated, certTier: p.cert_tier, certRecognition: p.cert_recognition, avatar: p.avatar || generateDefaultAvatar(p.name, p.kr8_id), joined: new Date(p.created_at || p.joined || Date.now()).getTime(), isPlaceholder: false, bio: p.bio || '',
      }));
      lastFetch = Date.now();
    }
    return dbProfilesCache;
  } catch (e) { console.warn('fetchDbProfiles exception:', e); return dbProfilesCache; }
}

export function getAccounts(): Account[] {
  if (Date.now() - lastFetch > 10000) {
    fetchDbProfiles().then(() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('kr8:accounts-updated')); });
  }
  return safeArray(dbProfilesCache, []);
}
export function getStudents(): Account[] { 
  try {
    return safeArray(getAccounts(), []).filter(a => a.type === 'student' || a.type === 'founder' || a.type === 'co-founder'); 
  } catch { return []; }
}
export async function getAccountsAsync(): Promise<Account[]> { return await fetchDbProfiles(); }
export async function getStudentsAsync(): Promise<Account[]> { const all = await fetchDbProfiles(); return safeArray(all, []).filter(a => a.type === 'student'); }
export function findStudent(idOrQuery: string): Account | undefined {
  if (!idOrQuery) return undefined;
  try {
    const raw = idOrQuery.trim(); const normalized = normalizeIdentity(raw); const emailQuery = normalizeEmail(raw); const phoneQuery = normalizePhone(raw);
    const accounts = safeArray(getAccounts(), []);
    const direct = accounts.find(s => s.id === raw || normalizeIdentity(s.id) === normalized);
    if (direct) return direct;
    const byEmail = accounts.find(s => s.email && normalizeEmail(s.email) === emailQuery);
    if (byEmail) return byEmail;
    if (phoneQuery.length >= 7) { const byPhone = accounts.find(s => s.phone && normalizePhone(s.phone) === phoneQuery); if (byPhone) return byPhone; }
    return accounts.find(s => s.name && s.name.trim().toLowerCase() === raw.toLowerCase());
  } catch { return undefined; }
}
export function saveAccounts(_a: Account[]) {}
export function updateAccount(_id: string, _patch: Partial<Account>): Account | undefined { return undefined; }
export function nextSerial(_skillKey: string): number { return Math.floor(Math.random() * 1000) + 1; }
export function registerStudent(_input: any): { ok: boolean; error?: string; student?: Account } { return { ok: false, error: "Use Supabase Auth - /register" }; }
export function getReferralUrl(id: string): string { const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://www.kr8digitals.com"; return `${origin}/academy?ref=${encodeURIComponent(id)}`; }

export type FeedItem = { id: string; kind: string; name: string; skill: string; avatar: string; ts: number; customAction?: string; };
export function feedAction(k: string) { const map: Record<string, string> = { submission: "submitted an assignment", attendance: "got attendance accepted", graduation: "just graduated", registration: "joined the Academy", tribe: "joined the Tribe", blog: "published a new post", project: "shipped a client project", stream_live: "is broadcasting live", stream_ended: "completed a live masterclass" }; return (map as any)[k] || "had an activity"; }
export function getFeed(): FeedItem[] { return []; }
export function addFeed(_item: any) {}
export function timeAgo(ts: number): string { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return `${s}s ago`; const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }

export const SOCIAL_LINKS = [
  { key: "youtube", label: "YouTube", href: "https://youtube.com/@kr8digitals", icon: "youtube" },
  { key: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@kr8digitals", icon: "tiktok" },
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com/kr8digitals_", icon: "instagram" },
  { key: "facebook", label: "Facebook", href: "https://www.facebook.com/share/19FLQJ8bok/", icon: "facebook" },
  { key: "x", label: "X", href: "https://x.com/kr8digitals", icon: "x" },
];
export function getSocialLinks() {
  try {
    const { getSiteSettingsSync } = require("./siteSettingsStore");
    const all = getSiteSettingsSync();
    if (all.social_links) return safeArray(all.social_links, SOCIAL_LINKS);
  } catch {}
  return SOCIAL_LINKS;
}
export function saveSocialLinks(_items: any) {
  try {
    const { updateSiteSetting } = require("./siteSettingsStore");
    updateSiteSetting('social_links', _items).catch(()=>{});
  } catch {}
}
export type PaymentSettings = { account: string; bank: string; name: string; advancedPrice: string };
export function getPaymentSettings(): PaymentSettings {
  try {
    const { getSiteSettingsSync } = require("./siteSettingsStore");
    const all = getSiteSettingsSync();
    if (all.payment) return all.payment;
  } catch {}
  return { ...CONTACT.payment, advancedPrice: "35000" };
}
export function savePaymentSettings(_v: PaymentSettings) {
  try {
    const { updateSiteSetting } = require("./siteSettingsStore");
    updateSiteSetting('payment', _v).catch(()=>{});
  } catch {}
}
export const AGENCY_SERVICES = [{ icon: "palette", t: "Brand Design", d: "Complete identity." }];
export const PORTFOLIO = [{ id: "p1", title: "AfriSTEM Global", service: "Website Development", client: "AfriSTEM Global", description: "Full responsive website.", link: "https://afristemglobal.org", price: "", showPrice: false, img: "/portfolio/afristem_hero.jpg", domain: "afristemglobal.org", placeholder: false }];
export function getPortfolio() { return PORTFOLIO; }
export function savePortfolio(_items: any) {}
export const BLOG: any[] = [];
export async function getBlogPosts(): Promise<any[]> {
  try {
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false }).limit(50);
    return safeArray(data, []);
  } catch { return []; }
}
export function getBlogPostsSync(): any[] { return []; }
export async function getBlogPostsAsync(): Promise<any[]> { return getBlogPosts(); }
export function saveBlogPosts(_posts: any[]) {}
export function createBlogPost(_input: any) { return null as any; }
export function toggleLikePost(_postId: string, _userKey: string) { return { likes: 0, liked: false }; }
export function addPostComment(_postId: string, _input: any) { return null as any; }
export const TESTIMONIALS = [{ id: "t1", name: "Amara Okeke", skill: "Graphic Design", caption: "Zero to studio.", img: IMG.woman1 }];
export function getTestimonials(): any[] {
  // Safe sync version - always returns array, never Promise
  return TESTIMONIALS as any;
}
export async function getTestimonialsAsync(): Promise<any[]> {
  try {
    const { data } = await supabase.from('testimonials').select('*').eq('approved', true).order('created_at', { ascending: false }).limit(20);
    return safeArray(data, TESTIMONIALS as any);
  } catch { return TESTIMONIALS as any; }
}
export function saveTestimonials(_items: any) {}
export function addTestimonial(_data: any) { return null as any; }
export function deleteTestimonial(_id: string) {}
export function updateTestimonial(_item: any) {}
export function getVideoComments() { return [] as any; }
export function saveVideoComments(_items: any) {}
export function addVideoComment(_data: any) { return null as any; }
export function deleteVideoComment(_id: string) {}
export function likeVideoComment(_id: string) { return 0; }
export const ATTENDANCE_TYPES = [
  { key: "class", name: "Class", schedule: "Mon, Wed, Fri", open: true }, 
  { key: "assignment", name: "Assignment", schedule: "Tue, Thu, Sat", open: true },
  { key: "mindset", name: "Mindset Shift", schedule: "Sun 9PM", open: true },
  { key: "hangout", name: "Creator Hangout", schedule: "Monthly", open: true },
];
export const FULL_PORTFOLIO_LINK = "https://drive.google.com/drive/folders/1700q1hqAFOos7ZpPmpzFatUmIEwpa6J6";
export const TRIBE_WHATSAPP = "https://chat.whatsapp.com/DgnBOEd5CfMHV8CTWgPNLH";
export function getTribeWhatsApp() {
  try {
    const { getSiteSettingsSync } = require("./siteSettingsStore");
    const all = getSiteSettingsSync();
    if (all.tribe_whatsapp) return typeof all.tribe_whatsapp === 'string' ? all.tribe_whatsapp : all.tribe_whatsapp.url || TRIBE_WHATSAPP;
  } catch {}
  return TRIBE_WHATSAPP;
}
export function saveCustomSkill(_skill: any) {}
export function deleteCustomSkill(_key: string) {}
export function saveDynamicCurriculum(_key: string, _weeks: any) {}
// Fixed: return Record, not {} causing crash, but safe empty record with proper type
export function getDynamicCurricula(): Record<string, Week[]> {
  try {
    return {};
  } catch {
    return {};
  }
}
export function getCustomSkills() { return [] as Skill[]; }
export function getWaitlistWhatsAppUrl() {
  try {
    const { getSiteSettingsSync } = require("./siteSettingsStore");
    const all = getSiteSettingsSync();
    if (all.waitlist_whatsapp) return typeof all.waitlist_whatsapp === 'string' ? all.waitlist_whatsapp : all.waitlist_whatsapp.url || TRIBE_WHATSAPP;
  } catch {}
  return TRIBE_WHATSAPP;
}
export function saveWaitlistWhatsAppUrl(_url: string) {
  try {
    const { updateSiteSetting } = require("./siteSettingsStore");
    updateSiteSetting('waitlist_whatsapp', _url).catch(()=>{});
  } catch {}
}
export function saveSkillSetting(_key: string, _patch: any) {}
// Fixed: return array with safe defaults, never {} 
export function getSkillSettings(): any[] {
  try {
    const mod = require("./skillsStore");
    if (mod && typeof mod.getSkillSettingsSync === 'function') {
      const arr = mod.getSkillSettingsSync();
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  // Fallback: map DEFAULT_SKILLS to SkillSetting shape
  return DEFAULT_SKILLS.map(s => ({
    skill_key: s.key,
    name: s.name,
    reg_open: s.regOpen,
    available: s.available,
    sort_order: 0,
    whatsapp_url: s.whatsapp,
    suffix: s.suffix,
    snippet: s.snippet,
    icon: s.icon,
  }));
}
export async function getSkillSettingsAsync(): Promise<any[]> {
  try {
    const mod = require("./skillsStore");
    if (mod && typeof mod.getSkillSettingsAsync === 'function') {
      const arr = await mod.getSkillSettingsAsync(true);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  return getSkillSettings();
}
export function getHomepageSettings() { return { projectsDone: 120, heroHeadline: "We Make It Happen.", narrativeLines: [], finalPunchline: "We Make It Happen.", doubtToBelief: [] }; }
export function saveHomepageSettings(_s: any) {}
export function getAnnouncementBar() {
  try {
    const { getSiteSettingsSync } = require("./siteSettingsStore");
    const all = getSiteSettingsSync();
    if (all.announcement_bar) return all.announcement_bar;
  } catch {}
  return { on: true, message: "KR8 Cohort Open" };
}
export function saveAnnouncementBar(_v: any) {
  try {
    const { updateSiteSetting } = require("./siteSettingsStore");
    updateSiteSetting('announcement_bar', _v).catch(()=>{});
  } catch {}
}
export function getAnnouncements(): any[] {
  // Safe sync version always returns array
  return [];
}
export async function getAnnouncementsAsync(): Promise<any[]> {
  try {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20);
    return safeArray(data, []);
  } catch { return []; }
}
export function saveAnnouncements(_items: any) {}
export function getGalleryItems(_filter?: any): any[] {
  // Safe sync version - always array, never Promise, supports filter arg safely
  try {
    return [];
  } catch { return []; }
}
export async function getGalleryItemsAsync(filter?: any): Promise<any[]> {
  try {
    let query = supabase.from('gallery_items').select('*').eq('approved', true).order('created_at', { ascending: false }).limit(30);
    if (filter?.category && filter.category !== 'All') {
      query = query.eq('category', filter.category);
    }
    const { data } = await query;
    return safeArray(data, []);
  } catch { return []; }
}
export function saveGalleryItems(_items: any) {}
export function addGalleryItem(_input: any) { return null; }
export function approveGalleryItem(_id: string) {}
export function rejectGalleryItem(_id: string) {}
export function deleteGalleryItem(_id: string) {}
export function archiveAnnouncementToGallery(_id: string) { return false; }
export function getClientRequests() { return [] as any; }
export function saveClientRequest(_data: any) { return { success: true, id: "req" }; }
export function updateClientRequestStatus(_id: string, _status: any) {}
export function deleteClientRequest(_id: string) {}
export function getAttendanceSubmissions(): any[] {
  return [];
}
export async function getAttendanceSubmissionsAsync(): Promise<any[]> {
  try {
    const { data } = await supabase.from('attendance_submissions').select('*').order('created_at', { ascending: false }).limit(100);
    return safeArray(data, []);
  } catch { return []; }
}
export function saveAttendanceSubmissions(_subs: any) {}
export function getStudentAttendance(_id: string): any[] {
  // Safe sync - always array
  return [];
}
export async function getStudentAttendanceAsync(_id: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('attendance_submissions').select('*').eq('user_id', _id).order('created_at', { ascending: false });
    return safeArray(data, []);
  } catch { return []; }
}
export async function submitAttendance(input: any): Promise<any> {
  try {
    const { data, error } = await supabase.from('attendance_submissions').insert({
      user_id: input.user_id || input.studentId,
      kr8_id: input.kr8_id || input.id,
      type: input.type || 'class',
      proof_url: input.proof_url || input.proofUrl || '',
      proof_text: input.proof_text || input.text || '',
      status: 'pending',
    }).select().single();
    if (error) throw error;
    return data;
  } catch (e: any) { return { ok: false, error: e.message }; }
}
export async function reviewAttendance(_id: string, status: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('attendance_submissions').update({ status, reviewed_at: new Date().toISOString() }).eq('id', _id);
    return !error;
  } catch { return false; }
}
// Fixed: return Record<string,boolean> with safe defaults, never {} empty causing undefined
export function getAttendanceTypesSettings(): Record<string, boolean> {
  try {
    const result: Record<string, boolean> = {};
    safeArray(ATTENDANCE_TYPES, []).forEach((t: any) => {
      result[t.key] = t.open;
    });
    return result;
  } catch {
    return { class: true, assignment: true, mindset: true, hangout: true };
  }
}
export function toggleAttendanceTypeOpen(_key: string, _open: boolean) {}
export function getAccountById(_id: string) { return undefined; }
export async function getDirectMessagesBetween(a: string, b: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('direct_messages').select('*').or(`and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`).order('created_at', { ascending: true }).limit(100);
    return safeArray(data, []);
  } catch { return []; }
}
export async function sendDirectMessage(sender: string, recipient: string, text: string) {
  try {
    const { data, error } = await supabase.from('direct_messages').insert({ sender_id: sender, recipient_id: recipient, text }).select().single();
    if (error) throw error;
    return { ok: true, message: data };
  } catch (e: any) { return { ok: false, error: e.message }; }
}
export function markConversationRead() {}
export function getStudentConversations(_id: string): any[] { 
  return [];
}
export async function getStudentConversationsAsync(_id: string): Promise<any[]> { 
  try { 
    const { data } = await supabase.from('direct_messages').select('*').or(`sender_id.eq.${_id},recipient_id.eq.${_id}`).order('created_at', { ascending: false }).limit(50); 
    return safeArray(data, []); 
  } catch { return []; } 
}
export function searchStudentsFast() { return [] as any; }
export async function getBlockedUserIds(_id: string): Promise<string[]> { try { const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', _id); return safeArray(data, []).map((r: any) => r.blocked_id); } catch { return []; } }
export async function blockStudent(a: string, b: string) { try { await supabase.from('blocks').insert({ blocker_id: a, blocked_id: b }); } catch {} }
export async function unblockStudent(a: string, b: string) { try { await supabase.from('blocks').delete().eq('blocker_id', a).eq('blocked_id', b); } catch {} }
export function isStudentBlocked() { return false; }
export function reportConversation() { return { ok: true, message: "Reported" }; }
export async function toggleFollowStudent(a: string, b: string) {
  try {
    const { data: existing } = await supabase.from('follows').select('id').eq('follower_id', a).eq('following_id', b).maybeSingle();
    if (existing) {
      await supabase.from('follows').delete().eq('id', existing.id);
      return { following: false };
    } else {
      await supabase.from('follows').insert({ follower_id: a, following_id: b });
      return { following: true };
    }
  } catch { return { following: false }; }
}
export function toggleFollowUser() { return false; }
export function saveVerifyRemark() { return undefined; }
export function getXpRules() { return [] as any; }
export function saveXpRules(_rules: any) {}
export async function getSuspendedAccounts(): Promise<any[]> { try { const { data } = await supabase.from('suspended_accounts').select('*').order('suspended_at', { ascending: false }).limit(100); return safeArray(data, []); } catch { return []; } }
export function saveSuspendedAccounts(_list: any) {}
export function isCredentialSuspended() { return { suspended: false }; }
export function revokeStudentRegistration() { return false; }
export async function suspendStudentAccount(id: string, reason: string) {
  try {
    const { data: profile } = await supabase.from('profiles').select('kr8_id').eq('id', id).maybeSingle();
    if (!profile) return false;
    const { error } = await supabase.from('suspended_accounts').insert({ user_id: id, kr8_id: profile.kr8_id, reason });
    return !error;
  } catch { return false; }
}
export async function submitSuspensionAppeal(id: string, text: string) {
  try {
    const { error } = await supabase.from('suspended_accounts').update({ appeal_text: text, appeal_at: new Date().toISOString(), status: 'appealed' }).eq('user_id', id).order('suspended_at', { ascending: false }).limit(1);
    return { ok: !error, message: error ? error.message : 'Appeal submitted' };
  } catch (e: any) { return { ok: false, message: e.message }; }
}
export async function restoreSuspendedAccount(id: string) {
  try {
    const { error } = await supabase.from('suspended_accounts').update({ status: 'restored', restored_at: new Date().toISOString() }).eq('user_id', id);
    return !error;
  } catch { return false; }
}
export async function upholdSuspendedAccount(id: string) {
  try {
    const { error } = await supabase.from('suspended_accounts').update({ status: 'upheld' }).eq('user_id', id);
    return !error;
  } catch { return false; }
}
export function authenticateAccount() { return { ok: false, error: "Use Supabase Auth - /signin" }; }
export function requestPasswordReset() { return { ok: false, message: "Use Supabase Auth - /signin reset" }; }
export function completePasswordReset() { return { ok: false, message: "Use Supabase Auth" }; }
export function recoverId() { return undefined; }
export function registerTribe() { return { ok: false, error: "Use Supabase Auth - /register" }; }
export function adminRegisterStudent() { return { ok: false, error: "Use Supabase Auth" }; }
export function getStudentCertificates(_id: string): any[] {
  // Safe sync - always array
  return [];
}
export async function getStudentCertificatesAsync(id: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('certificates').select('*').eq('student_id', id).order('issued_at', { ascending: false });
    return safeArray(data, []);
  } catch { return []; }
}
export function getCertificateById() { return {}; }
export function issueCertificate() { return { ok: false, error: "Use server function issueCertificate from @/lib/certificate.functions" }; }
export function withdrawCertificate() { return { ok: false, error: "Use server function withdrawCertificate" }; }
export function getStudentNotifications(_id: string): any[] {
  return [];
}
export async function getStudentNotificationsAsync(id: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(20);
    return safeArray(data, []);
  } catch { return []; }
}
export async function markNotificationRead(_studentId: string, notifId: string) { try { await supabase.from('notifications').update({ read: true }).eq('id', notifId); } catch {} }
export type VerificationResult = { ok: boolean; account?: Account; };
export function verifyId(): VerificationResult { return { ok: false }; }
export const COHORT_YEAR = 2026;
export function isVip() { return false; }
export function fdAllowed() { return false; }
export function isExecutiveAccount(account?: any): boolean {
  if (!account) return false;
  return account.isFounder || account.isCoFounder || account.type === "founder" || account.type === "co-founder" || account.roles?.some((r: any) => ['founder','co-founder'].includes(r.role));
}
export function isUltimateAdmin(account?: any) {
  if (!account) return false;
  return account.isFounder || account.type === "founder" || account.admin?.role === "ultimate" || account.roles?.some((r: any) => r.role === 'founder');
}
export function getRecognizedAdmin() { return undefined; }
export function canAccessAdminSection(account: any, section: string): boolean {
  if (!account) return false;
  if (account.isFounder || account.type === 'founder') return true;
  const roles = account.roles || [];
  const isAdmin = roles.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
  if (!isAdmin) return false;
  if (roles.some((r: any) => ['founder','co-founder'].includes(r.role))) return true;
  const adminRole = roles.find((r: any) => r.role === 'admin');
  if (!adminRole) return false;
  const perms = adminRole.permissions as string[] || [];
  if (perms.length === 0) return true;
  return perms.includes(section) || perms.includes('all');
}
export function promoteAccount() { return undefined; }
export function demoteAccount() { return undefined; }
export function resetAdminPassword() { return undefined; }
export function getSkillSuffix(skillKey: string) { const s = getSkill(skillKey); return s?.suffix || "VFD"; }
export function getSkillCode(skillKey: string) { const suffix = getSkillSuffix(skillKey); return suffix.replace(/VFD$/i, "") || skillKey.toUpperCase().slice(0, 3); }
export const SCORING = [{ action: "Attendance accepted", pts: "+10" }];
export function tribeCount() { return 2480; }
export function studentCount() { return 1200; }
export const PARTNERS = ["Motionverse", "CHIGOMA"];
export type Testimonial = any;
export type VideoComment = any;
export const REAL_STUDENT_TESTIMONIALS: any[] = [];
export type DoubtToBeliefStep = { doubt: string; belief: string; };
export const DEFAULT_DOUBT_TO_BELIEF: DoubtToBeliefStep[] = [{ doubt: "I can't", belief: "You can" }];
export const DEFAULT_NARRATIVE_LINES: string[] = ["From zero to professional."];
export type XpRule = { action: string; points: number; };
export function areAllRegistrationsClosed() { 
  try {
    const all = getSkills();
    if (!Array.isArray(all) || all.length===0) return false;
    return all.filter(s=>s.available).every(s=>!s.regOpen);
  } catch { return false; }
}
export type CertificateRecord = any;
export const ANNOUNCEMENT_BAR = { on: true, message: "KR8 Cohort Open" };
export type Announcement = { id: string; title: string; body?: string; date: string; author: string; };
export const ANNOUNCEMENTS: Announcement[] = [];
export type GalleryItem = any;
export const INITIAL_GALLERY_ITEMS: GalleryItem[] = [];
export type BlogPost = any;
export type BlogComment = any;
export const DEFAULT_XP_RULES: any[] = [];
export type StreamRole = "host" | "co-host" | "panelist" | "moderator" | "attendee" | "speaker" | "viewer";
export type LiveStreamParticipant = { id: string; name: string; avatar?: string; role: StreamRole; joinedAt: number; isMuted?: boolean; isVideoOn?: boolean; handRaised?: boolean; };
export type LiveChatMessage = { id: string; streamId: string; senderId: string; senderName: string; senderRole: StreamRole; text: string; createdAt: number; };
export type LiveStream = { id: string; title: string; category: string; description: string; hostId: string; hostName: string; hostAvatar?: string; visibility: "public" | "private"; accessKey?: string; isLive: boolean; startedAt: number; viewerCount: number; peakViewers: number; quality: string; livekitRoomName?: string; posterUrl?: string; viewers: LiveStreamParticipant[]; };
export type StreamReplay = { id: string; title: string; hostName: string; category: string; date: string; durationMinutes: number; peakViewers: number; thumbnail: string; videoUrl: string; messagesCount: number; };
export type StreamRecordingItem = { id: string; title: string; hostName: string; category: string; durationMinutes: number; videoUrl: string; thumbnail: string; recordedAt: string; isPublic: boolean; };
export function getActiveLiveStream(): LiveStream | null { try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('kr8_live_stream_v2') : null; if (raw) { const parsed = JSON.parse(raw); if (parsed?.isLive) return parsed; } } catch {} return null; }
export function saveActiveLiveStream(_stream: LiveStream | null) {}
export function startLiveStream(_input: any): LiveStream { return { id: `stream-${Date.now()}`, title: "Live", category: "General", description: "", hostId: "founder", hostName: "Timfire", isLive: true, startedAt: Date.now(), viewerCount: 1, peakViewers: 1, quality: "720p", viewers: [] } as any; }
export function endActiveLiveStream(): StreamReplay | null { return null; }
export function getLiveChatMessages(_streamId: string): LiveChatMessage[] { return []; }
export function saveLiveChatMessages(_streamId: string, _messages: LiveChatMessage[]) {}
export function sendLiveChatMessage(_input: any): LiveChatMessage { return { id: "msg", streamId: "", senderId: "", senderName: "", senderRole: "viewer", text: "", createdAt: Date.now() } as any; }
export function pinLiveChatMessage(_streamId: string, _messageId: string) {}
export function deleteLiveChatMessage(_streamId: string, _messageId: string) {}
export function joinStreamViewer(_streamId: string, _participant: LiveStreamParticipant) {}
export function leaveStreamViewer(_streamId: string, _participantId: string) {}
export function toggleParticipantMute(_streamId: string, _participantId: string) { return false; }
export function muteAllListeners(_streamId: string) {}
export function getStreamReplays(): StreamReplay[] { return []; }
export function saveStreamReplays(_replays: StreamReplay[]) {}
export function getLastEndedStream(): StreamReplay | null { return null; }
export function canUserHostStream(account: any): boolean { if (!account) return false; return account.isFounder || account.isCoFounder || account.isAdmin || account.isHost || account.type === "founder" || account.type === "co-founder"; }
export function getEligibleStreamHosts() { return [] as any; }
export const INITIAL_STREAM_REPLAYS: StreamReplay[] = [];
export function markStreamTerminated(_streamId: string) {}
export function isStreamTerminated(_streamId: string) { return false; }
export function assignTaskToViewer(_streamId: string, _input: any) { return null as any; }
export function completeStreamTask(_streamId: string, _taskId: string) { return false; }
export function awardPointsToStreamViewer(_streamId: string, _userId: string, _userName: string, _points: number, _reason: string) {}
export function updateLiveStream(_updates: any) { return null as any; }
export function getStreamQuestions(_streamId: string) { return [] as any; }
export function saveStreamQuestions(_streamId: string, _questions: any) {}
export function submitStreamQuestion(_input: any) { return null as any; }
export function upvoteStreamQuestion(_streamId: string, _questionId: string, _userId: string) {}
export function answerStreamQuestion(_streamId: string, _questionId: string, _answer: string, _visibility: any, _answeredBy: string) {}
export function dismissStreamQuestion(_streamId: string, _questionId: string) {}
export function getStreamPolls(_streamId: string) { return [] as any; }
export function saveStreamPolls(_streamId: string, _polls: any) {}
export function createStreamPoll(_input: any) { return null as any; }
export function voteStreamPoll(_streamId: string, _pollId: string, _optionIndex: number, _respondentId: string) { return false; }
export function closeStreamPoll(_streamId: string, _pollId: string) {}
export function getStreamAccessRequests(_streamId?: string) { return [] as any; }
export function requestStreamAccess(_input: any) { return null as any; }
export function respondStreamAccessRequest(_requestId: string, _status: any, _message?: string) {}
export function getStreamInvites(_streamId?: string) { return [] as any; }
export function createStreamInvite(_input: any) { return null as any; }
export function getStreamRecordings(): StreamRecordingItem[] { return []; }
export function saveStreamRecordings(_recordings: StreamRecordingItem[]) {}
export function addStreamRecording(_rec: StreamRecordingItem) {}
export function deleteStreamRecording(_id: string) {}
export function toggleStreamRecordingPublic(_id: string) {}
export function promoteParticipantRole(_streamId: string, _participantId: string, _newRole: StreamRole) {}
export function toggleRaiseHand(_streamId: string, _participantId: string, _raised: boolean) {}
export function setSpotlightParticipant(_streamId: string, _participantId: string | null) {}
export function setChatPermission(_streamId: string, _permission: any) {}
export function toggleStreamLock(_streamId: string, _locked: boolean) {}
export function suspendStreamActivities(_streamId: string) {}
export function setBreakoutRooms(_streamId: string, _breakouts: any) {}
export function promoteViewerToMod(_streamId: string, _participantKey: string) {}
export function promoteViewerToSpeaker(_streamId: string, _participantKey: string) {}
export function demoteViewer(_streamId: string, _participantKey: string) {}
export type ClientRequest = any;
export type AttendanceSubmission = any;

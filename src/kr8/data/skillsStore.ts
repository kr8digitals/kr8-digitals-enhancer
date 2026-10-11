// Skills store - DB-first, reads skill_settings table
// Visitors: select only skill_key, name, reg_open, available, sort_order
// Signed-in: may also read whatsapp_url
import { supabase } from "@/integrations/supabase/client";

export type SkillSetting = {
  skill_key: string;
  name: string;
  reg_open: boolean;
  available: boolean;
  sort_order: number;
  whatsapp_url?: string | null;
  suffix?: string | null;
  snippet?: string | null;
  icon?: string | null;
};

let cache: SkillSetting[] = [];
let lastFetch = 0;
let listeners: (() => void)[] = [];

const CACHE_TTL = 60 * 1000; // 60 seconds - changes show within 60s

async function fetchSkillsFromDB(isAuthed: boolean): Promise<SkillSetting[]> {
  try {
    // For visitors, select only limited columns; for authed, include whatsapp_url
    const columns = isAuthed
      ? "skill_key,name,reg_open,available,sort_order,whatsapp_url,suffix,snippet,icon"
      : "skill_key,name,reg_open,available,sort_order,suffix,snippet,icon";

    const { data, error } = await supabase
      .from('skill_settings')
      .select(columns)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('skill_settings fetch error:', error.message);
      return cache.length ? cache : [];
    }

    if (data && data.length > 0) {
      cache = data as any;
      lastFetch = Date.now();
      // Notify listeners for live update within 60s
      listeners.forEach(l => { try { l(); } catch {} });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kr8:skills-updated', { detail: cache }));
      }
      return cache;
    }
    return cache;
  } catch (e) {
    console.warn('fetchSkills exception:', e);
    return cache;
  }
}

export async function getSkillSettingsAsync(isAuthed = false): Promise<SkillSetting[]> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && cache.length > 0) {
    return cache;
  }
  return await fetchSkillsFromDB(isAuthed);
}

export function getSkillSettingsSync(): SkillSetting[] {
  if (Date.now() - lastFetch > CACHE_TTL) {
    // Trigger background refresh, but return cache immediately
    fetchSkillsFromDB(false).catch(() => {});
  }
  return cache;
}

export function onSkillsUpdate(cb: () => void): () => void {
  listeners.push(cb);
  const handler = () => cb();
  if (typeof window !== 'undefined') {
    window.addEventListener('kr8:skills-updated', handler as any);
  }
  return () => {
    listeners = listeners.filter(l => l !== cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('kr8:skills-updated', handler as any);
    }
  };
}

// For compatibility with old getSkills() - returns in old Skill format
export type SkillCompat = {
  key: string;
  name: string;
  suffix: string;
  whatsapp: string;
  available: boolean;
  regOpen: boolean;
  snippet: string;
  icon: string;
  instructor: any;
  curriculum: any[];
  criteria: string;
};

const DEFAULT_FALLBACK: SkillCompat[] = [
  { key: "graphic", name: "Graphic Design", suffix: "GDVFD", whatsapp: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU", available: true, regOpen: true, snippet: "8-week graphic design — live drills, real tutors.", icon: "palette", instructor: null, curriculum: [], criteria: "" },
  { key: "video", name: "Video Editing & Animation", suffix: "VEVFD", whatsapp: "https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M", available: true, regOpen: true, snippet: "8-week video editing — cinematic storytelling.", icon: "video", instructor: null, curriculum: [], criteria: "" },
  { key: "web", name: "Website Development", suffix: "WDVFD", whatsapp: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v", available: true, regOpen: true, snippet: "8-week website development — ship live sites.", icon: "code", instructor: null, curriculum: [], criteria: "" },
  { key: "frontend", name: "Front-End Development", suffix: "FEDVFD", whatsapp: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v", available: true, regOpen: true, snippet: "8-week frontend — React, performance, conversion.", icon: "code", instructor: null, curriculum: [], criteria: "" },
  { key: "content_creation", name: "Content Creation", suffix: "CCVFD", whatsapp: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU", available: false, regOpen: false, snippet: "8-week creator programme — launching next cohort.", icon: "video", instructor: null, curriculum: [], criteria: "" },
  { key: "smm", name: "Social Media Management", suffix: "SMMVFD", whatsapp: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU", available: false, regOpen: false, snippet: "8-week SMM — launching next cohort.", icon: "mobile", instructor: null, curriculum: [], criteria: "" },
  { key: "marketing", name: "Digital Marketing", suffix: "DMVFD", whatsapp: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v", available: false, regOpen: false, snippet: "8-week marketing — launching next cohort.", icon: "chart", instructor: null, curriculum: [], criteria: "" },
];

export function getSkillsFromCache(): SkillCompat[] {
  const db = getSkillSettingsSync();
  if (db.length === 0) return DEFAULT_FALLBACK;
  return db.map(s => ({
    key: s.skill_key,
    name: s.name,
    suffix: s.suffix || s.skill_key.toUpperCase().slice(0,3) + 'VFD',
    whatsapp: (s as any).whatsapp_url || DEFAULT_FALLBACK.find(d => d.key === s.skill_key)?.whatsapp || "",
    available: s.available,
    regOpen: s.reg_open,
    snippet: (s as any).snippet || "",
    icon: (s as any).icon || "code",
    instructor: null,
    curriculum: [],
    criteria: "",
  }));
}

// Poll every 60s for live updates (quota safe: 60-120s)
let pollInterval: any = null;
export function startSkillsPolling(isAuthed: boolean) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    fetchSkillsFromDB(isAuthed).catch(() => {});
  }, 60000); // 60s
  // Initial fetch
  fetchSkillsFromDB(isAuthed).catch(() => {});
}

export function stopSkillsPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Admin functions
export async function updateSkillSetting(skill_key: string, patch: Partial<SkillSetting>) {
  // Validate whatsapp_url if present
  if (patch.whatsapp_url !== undefined && patch.whatsapp_url !== null) {
    const url = patch.whatsapp_url.trim();
    if (url && !url.startsWith('https://chat.whatsapp.com/')) {
      throw new Error('WhatsApp URL must start with https://chat.whatsapp.com/');
    }
  }

  const { data, error } = await (supabase as any)
    .from('skill_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('skill_key', skill_key)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update cache immediately for live site within 60s and reload survival
  cache = cache.map(c => c.skill_key === skill_key ? { ...c, ...patch } as any : c);
  lastFetch = Date.now();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kr8:skills-updated', { detail: cache }));
  }
  listeners.forEach(l => { try { l(); } catch {} });

  return data;
}

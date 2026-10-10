// Site settings store - DB-first for social_links, tribe_whatsapp, waitlist_whatsapp, announcement_bar, payment
import { supabase } from "@/integrations/supabase/client";

export type SiteSettingKey = 'social_links' | 'tribe_whatsapp' | 'waitlist_whatsapp' | 'announcement_bar' | 'payment';

type CacheEntry = {
  key: SiteSettingKey;
  value: any;
  updated_at: string;
};

let cache: Record<string, any> = {};
let lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 60s - changes show within 60s
let listeners: (() => void)[] = [];

const DEFAULTS: Record<SiteSettingKey, any> = {
  social_links: [
    { key: "youtube", label: "YouTube", href: "https://youtube.com/@kr8digitals", icon: "youtube", enabled: true },
    { key: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@kr8digitals", icon: "tiktok", enabled: true },
    { key: "instagram", label: "Instagram", href: "https://www.instagram.com/kr8digitals_", icon: "instagram", enabled: true },
    { key: "facebook", label: "Facebook", href: "https://www.facebook.com/share/19FLQJ8bok/", icon: "facebook", enabled: true },
    { key: "x", label: "X", href: "https://x.com/kr8digitals", icon: "x", enabled: true },
  ],
  tribe_whatsapp: "https://chat.whatsapp.com/DgnBOEd5CfMHV8CTWgPNLH",
  waitlist_whatsapp: "https://chat.whatsapp.com/DgnBOEd5CfMHV8CTWgPNLH",
  announcement_bar: { on: true, message: "KR8 Cohort Open - Registration Live!" },
  payment: { account: "8166552758", bank: "OPay", name: "Kenneth Timothy", advancedPrice: "35000" },
};

async function fetchAllFromDB(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key,value,updated_at');

    if (error) {
      console.warn('site_settings fetch error:', error.message);
      return cache;
    }

    if (data && data.length > 0) {
      const newCache: Record<string, any> = {};
      (data as any[]).forEach(row => {
        newCache[row.key] = row.value;
      });
      cache = { ...DEFAULTS, ...newCache };
      lastFetch = Date.now();
      listeners.forEach(l => { try { l(); } catch {} });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kr8:site-settings-updated', { detail: cache }));
      }
      return cache;
    }
    return cache;
  } catch (e) {
    console.warn('site_settings exception:', e);
    return cache;
  }
}

export async function getSiteSettingsAsync(): Promise<Record<string, any>> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && Object.keys(cache).length > 0) {
    return cache;
  }
  return await fetchAllFromDB();
}

export function getSiteSettingsSync(): Record<string, any> {
  if (Date.now() - lastFetch > CACHE_TTL) {
    fetchAllFromDB().catch(() => {});
  }
  if (Object.keys(cache).length === 0) {
    return DEFAULTS;
  }
  return cache;
}

export function getSiteSetting<T>(key: SiteSettingKey, fallback?: T): T {
  const all = getSiteSettingsSync();
  if (all[key] !== undefined) return all[key] as T;
  if (fallback !== undefined) return fallback;
  return DEFAULTS[key] as T;
}

// Specific getters to replace old hardcoded functions
export function getSocialLinksFromDB() {
  return getSiteSetting('social_links', DEFAULTS.social_links);
}

export function getTribeWhatsAppFromDB() {
  const val = getSiteSetting('tribe_whatsapp', DEFAULTS.tribe_whatsapp);
  return typeof val === 'string' ? val : (val as any)?.url || DEFAULTS.tribe_whatsapp;
}

export function getWaitlistWhatsAppFromDB() {
  const val = getSiteSetting('waitlist_whatsapp', DEFAULTS.waitlist_whatsapp);
  return typeof val === 'string' ? val : (val as any)?.url || DEFAULTS.waitlist_whatsapp;
}

export function getAnnouncementBarFromDB() {
  return getSiteSetting('announcement_bar', DEFAULTS.announcement_bar);
}

export function getPaymentSettingsFromDB() {
  return getSiteSetting('payment', DEFAULTS.payment);
}

export function onSiteSettingsUpdate(cb: () => void): () => void {
  listeners.push(cb);
  const handler = () => cb();
  if (typeof window !== 'undefined') {
    window.addEventListener('kr8:site-settings-updated', handler as any);
  }
  return () => {
    listeners = listeners.filter(l => l !== cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('kr8:site-settings-updated', handler as any);
    }
  };
}

let pollInterval: any = null;
export function startSiteSettingsPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    fetchAllFromDB().catch(() => {});
  }, 60000); // 60s - quota safe, shows within 60s, survives reload
  fetchAllFromDB().catch(() => {});
}

export function stopSiteSettingsPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Admin update
export async function updateSiteSetting(key: SiteSettingKey, value: any) {
  const { data, error } = await (supabase as any)
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single();

  if (error) throw new Error(error.message);

  cache[key] = value;
  lastFetch = Date.now();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kr8:site-settings-updated', { detail: cache }));
  }
  listeners.forEach(l => { try { l(); } catch {} });

  return data;
}

// Initialize on load
if (typeof window !== 'undefined') {
  // Start polling automatically
  startSiteSettingsPolling();
  // Also try to load immediately
  fetchAllFromDB().catch(() => {});
}

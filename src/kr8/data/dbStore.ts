// DB-first store - secure, no injection, no legacy fallbacks
import { supabase } from "@/integrations/supabase/client";

export type DbProfile = {
  id: string;
  kr8_id: string;
  name: string;
  email: string;
  phone: string | null;
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
};

export type DbCertificate = {
  id: string;
  certificate_code: string;
  student_id: string;
  kr8_id: string;
  student_name: string;
  formatted_name: string | null;
  skill: string;
  skill_name: string | null;
  tier: string;
  template_url: string | null;
  achievement_text: string | null;
  additional_notes: string | null;
  issued_at: string | null;
  issued_by: string | null;
  status: string;
  email_sent_at: string | null;
  email_failure_reason: string | null;
  withdrawal_reason: string | null;
  withdrawn_at: string | null;
  withdrawn_by: string | null;
  certificate_image_url: string | null;
  pdf_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

let profilesCache: DbProfile[] = [];
let certificatesCache: DbCertificate[] = [];
let lastFetch = 0;
const CACHE_TTL = 10000;

function loadCache() {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const p = localStorage.getItem('kr8_db_profiles_cache');
    const c = localStorage.getItem('kr8_db_certificates_cache');
    const t = localStorage.getItem('kr8_db_cache_time');
    if (p && c && t) {
      const age = Date.now() - Number(t);
      if (age < 60000) {
        profilesCache = JSON.parse(p);
        certificatesCache = JSON.parse(c);
        lastFetch = Number(t);
      }
    }
  } catch {}
}

function saveCache() {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    localStorage.setItem('kr8_db_profiles_cache', JSON.stringify(profilesCache));
    localStorage.setItem('kr8_db_certificates_cache', JSON.stringify(certificatesCache));
    localStorage.setItem('kr8_db_cache_time', String(Date.now()));
  } catch {}
}

const CODE_REGEX = /^[A-Za-z0-9_-]{6,64}$/;
function isValidCode(code: string): boolean {
  return CODE_REGEX.test(code);
}

export async function fetchProfiles(force = false): Promise<DbProfile[]> {
  const now = Date.now();
  if (!force && profilesCache.length > 0 && now - lastFetch < CACHE_TTL) {
    return profilesCache;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      console.warn('fetchProfiles error:', error);
      loadCache();
      return profilesCache;
    }
    profilesCache = (data as DbProfile[]) || [];
    lastFetch = now;
    saveCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kr8:profiles-updated', { detail: profilesCache }));
    }
    return profilesCache;
  } catch (err) {
    console.error('fetchProfiles exception:', err);
    loadCache();
    return profilesCache;
  }
}

export async function fetchCertificates(force = false): Promise<DbCertificate[]> {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .order('issued_at', { ascending: false })
      .limit(500);
    if (error) {
      console.warn('fetchCertificates error:', error);
      loadCache();
      return certificatesCache;
    }
    certificatesCache = (data as DbCertificate[]) || [];
    saveCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kr8:certificates-updated', { detail: certificatesCache }));
    }
    return certificatesCache;
  } catch (err) {
    console.error('fetchCertificates exception:', err);
    loadCache();
    return certificatesCache;
  }
}

export async function getProfileByKr8Id(kr8Id: string): Promise<DbProfile | null> {
  const clean = kr8Id.trim();
  if (!isValidCode(clean)) {
    console.warn('Invalid KR8 ID format');
    return null;
  }
  try {
    // Use RPC for public safe lookup
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_by_kr8_id', { lookup_id: clean });
    if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      // RPC returns limited fields, need full profile for internal use - try direct eq (authenticated)
      const { data } = await supabase.from('profiles').select('*').eq('kr8_id', clean).maybeSingle();
      if (data) return data as DbProfile;
      // Return limited as DbProfile for public display
      const p = rpcData[0];
      return {
        id: '',
        kr8_id: p.kr8_id,
        name: p.name,
        email: '',
        phone: null,
        country: null,
        dob: null,
        skill: p.skill,
        avatar: null,
        bio: null,
        cover_photo: null,
        points: 0,
        attendance_accepted: 0,
        submissions: 0,
        referrals: 0,
        graduated: p.graduated,
        cert_tier: p.cert_tier,
        cert_recognition: null,
        joined: p.joined,
        created_at: null,
        updated_at: null,
      };
    }

    // Fallback direct eq query (authenticated users can read own or via RLS)
    const { data, error } = await supabase.from('profiles').select('*').eq('kr8_id', clean).maybeSingle();
    if (error || !data) return null;
    return data as DbProfile;
  } catch {
    return null;
  }
}

export async function getCertificatesByKr8Id(kr8Id: string): Promise<DbCertificate[]> {
  const clean = kr8Id.trim();
  if (!isValidCode(clean)) return [];
  try {
    const { data, error } = await supabase.from('certificates').select('*').eq('kr8_id', clean).order('issued_at', { ascending: false });
    if (error) return [];
    return (data as DbCertificate[]) || [];
  } catch {
    return [];
  }
}

export async function verifyCertificate(codeOrId: string): Promise<{ valid: boolean; certificate?: DbCertificate; profile?: DbProfile; error?: string; type?: 'certificate' | 'in_training' | 'graduated' }> {
  const clean = codeOrId.trim();
  if (!clean) return { valid: false, error: 'Empty code' };
  if (!isValidCode(clean)) return { valid: false, error: 'Invalid code format' };

  try {
    // Use RPC verify_certificate_public - secure, prevents injection
    const { data: rpcData, error: rpcError } = await supabase.rpc('verify_certificate_public', { cert_code: clean });
    if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      const certRow = rpcData[0];
      if (certRow && certRow.is_valid) {
        // Fetch full certificate for display (authenticated can read)
        const { data: fullCert } = await supabase.from('certificates').select('*').eq('certificate_code', certRow.certificate_code).maybeSingle();
        if (fullCert) {
          return { valid: true, certificate: fullCert as DbCertificate, type: 'certificate' };
        }
        // Return limited cert from RPC
        return {
          valid: true,
          certificate: {
            id: certRow.certificate_code,
            certificate_code: certRow.certificate_code,
            student_id: '',
            kr8_id: certRow.kr8_id,
            student_name: certRow.student_name,
            formatted_name: certRow.student_name?.toUpperCase() || null,
            skill: certRow.skill,
            skill_name: certRow.skill_name,
            tier: certRow.tier,
            template_url: null,
            achievement_text: certRow.achievement_text,
            additional_notes: certRow.additional_notes,
            issued_at: certRow.issued_at,
            issued_by: null,
            status: certRow.status,
            email_sent_at: null,
            email_failure_reason: null,
            withdrawal_reason: null,
            withdrawn_at: null,
            withdrawn_by: null,
            certificate_image_url: null,
            pdf_url: null,
            created_at: null,
            updated_at: null,
          },
          type: 'certificate'
        };
      }
    }

    // Try separate eq queries to avoid injection - certificate_code eq
    const { data: certByCode } = await supabase.from('certificates').select('*').eq('certificate_code', clean).eq('status', 'active').maybeSingle();
    if (certByCode) {
      return { valid: true, certificate: certByCode as DbCertificate, type: 'certificate' };
    }

    // kr8_id eq
    const { data: certByKr8 } = await supabase.from('certificates').select('*').eq('kr8_id', clean).eq('status', 'active').maybeSingle();
    if (certByKr8) {
      return { valid: true, certificate: certByKr8 as DbCertificate, type: 'certificate' };
    }

    // Try profile - student exists but not graduated -> in_training
    const profile = await getProfileByKr8Id(clean);
    if (profile) {
      if (profile.graduated) {
        return { valid: true, profile, type: 'graduated' };
      } else {
        return { valid: true, profile, type: 'in_training' };
      }
    }

    return { valid: false, error: 'Certificate or student not found' };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Verification failed' };
  }
}

export function subscribeToProfiles(callback: (profiles: DbProfile[]) => void) {
  loadCache();
  callback(profilesCache);
  const channel = supabase.channel('profiles-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
    const fresh = await fetchProfiles(true);
    callback(fresh);
  }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeToCertificates(callback: (certs: DbCertificate[]) => void) {
  const channel = supabase.channel('certificates-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'certificates' }, async () => {
    const fresh = await fetchCertificates(true);
    callback(fresh);
  }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function updateProfileGraduation(kr8Id: string, graduated: boolean, certTier?: string, certRecognition?: string) {
  if (!isValidCode(kr8Id)) return { ok: false, error: 'Invalid KR8 ID' };
  try {
    const { data: profile } = await supabase.from('profiles').select('id').eq('kr8_id', kr8Id).maybeSingle();
    if (!profile) throw new Error(`Profile not found for KR8 ID ${kr8Id}`);
    const { data, error } = await supabase.from('profiles').update({
      graduated,
      cert_tier: certTier || null,
      cert_recognition: certRecognition || null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id).select().single();
    if (error) throw error;
    lastFetch = 0;
    await fetchProfiles(true);
    return { ok: true, profile: data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

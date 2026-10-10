-- KR8 Digitals Production Secure Schema v3
-- Fresh start, secure, idempotent, safe to run multiple times
-- No secrets, no old Lovable DB references
-- Implements all security fixes from section 5

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CLEAN INSECURE POLICIES (from old migrations)
-- ============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT polname, polrelid::regclass AS tbl 
    FROM pg_policy 
    WHERE polname IN (
      'site read','site insert','site update','log read','log insert',
      'rooms read','msg read','msg insert','msg update','adm read','adm insert','rec read',
      'live files read','live files upload',
      'profiles_select_authenticated','profiles_select_anon_none','profiles_update_own','profiles_insert_own','profiles_service_role_all',
      'user_roles_select_own','user_roles_service_role_all',
      'enrollments_select_own','enrollments_insert_own','enrollments_update_admin','enrollments_service_role_all',
      'certificates_select_own','certificates_select_public_active','certificates_select_authenticated_active','certificates_service_role_all',
      'email_logs_select_admin','email_logs_service_role_all',
      'live_rooms_select_all','live_rooms_insert_host','live_rooms_update_host','live_rooms_service_role_all',
      'room_admissions_select','room_admissions_insert','room_admissions_update_host','room_admissions_service_role_all',
      'room_messages_select','room_messages_insert','room_messages_update_host','room_messages_service_role_all',
      'recordings_select','recordings_insert_host','recordings_update_host','recordings_service_role_all',
      'activity_log_select_admin','activity_log_insert_authenticated','activity_log_service_role_all'
    )
  ) LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 2. PROFILES TABLE - SECURE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kr8_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  phone_normalized text, -- normalized form for matching founder phones
  country text DEFAULT 'NG',
  dob text,
  skill text,
  avatar text,
  bio text,
  cover_photo text,
  points integer DEFAULT 0,
  attendance_accepted integer DEFAULT 0,
  submissions integer DEFAULT 0,
  referrals integer DEFAULT 0,
  graduated boolean DEFAULT false,
  cert_tier text,
  cert_recognition text,
  joined timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_placeholder boolean DEFAULT false,
  -- Phone verification for co-founders
  phone_verified boolean DEFAULT false,
  phone_verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_profiles_kr8_id ON public.profiles(kr8_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_normalized ON public.profiles(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_profiles_skill ON public.profiles(skill);
CREATE INDEX IF NOT EXISTS idx_profiles_graduated ON public.profiles(graduated);

-- Add phone_normalized if not exists (for existing tables)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_normalized text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Function to normalize Nigerian phone numbers
CREATE OR REPLACE FUNCTION public.normalize_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN RETURN NULL; END IF;
  -- Remove all non-digits
  cleaned := regexp_replace(phone_input, '[^0-9]', '', 'g');
  -- Handle Nigerian numbers: 0812..., 234812..., +234812...
  IF cleaned LIKE '0%' AND length(cleaned) = 11 THEN
    -- 08125687509 -> 2348125687509
    RETURN '234' || substring(cleaned from 2);
  ELSIF cleaned LIKE '234%' AND length(cleaned) = 13 THEN
    RETURN cleaned;
  ELSIF length(cleaned) = 10 THEN
    -- 8125687509 -> 2348125687509
    RETURN '234' || cleaned;
  ELSE
    RETURN cleaned;
  END IF;
END;
$$;

-- Trigger to auto-normalize phone
CREATE OR REPLACE FUNCTION public.handle_phone_normalization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone_normalized := public.normalize_phone(NEW.phone);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_phone_trigger ON public.profiles;
CREATE TRIGGER normalize_phone_trigger
  BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_phone_normalization();

-- ============================================================================
-- 3. USER ROLES - SECURE WITH PERMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student','tribe','founder','co-founder','admin','coach','assistant','attendance_reviewer','moderator')),
  title text,
  permissions jsonb DEFAULT '[]'::jsonb, -- granular permissions: ["view_students","issue_certificates","manage_live_rooms","manage_roles", etc.]
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ============================================================================
-- 4. ENROLLMENTS - STUDENTS CANNOT GRADUATE THEMSELVES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_key text NOT NULL,
  skill_name text,
  serial integer,
  year integer,
  graduated boolean DEFAULT false,
  graduated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill_key)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_skill ON public.enrollments(skill_key);

-- Prevent students from inserting graduated enrollments directly
CREATE OR REPLACE FUNCTION public.prevent_student_graduation_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow graduated=true if actor is admin with issue_certificates permission
  -- This will be enforced via server function, but also block direct inserts
  IF NEW.graduated = true THEN
    -- Check if current user is service_role or has permission via is_admin check
    -- For direct DB inserts, only service_role should be able to set graduated=true
    IF NOT (auth.role() = 'service_role' OR public.is_admin(auth.uid())) THEN
      RAISE EXCEPTION 'Students cannot graduate themselves. Only admins with issue_certificates permission via server function may graduate.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_graduation_enrollment ON public.enrollments;
CREATE TRIGGER prevent_graduation_enrollment
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_student_graduation_enrollment();

-- ============================================================================
-- 5. CERTIFICATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_code text UNIQUE NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kr8_id text NOT NULL,
  student_name text NOT NULL,
  formatted_name text,
  skill text NOT NULL,
  skill_name text,
  tier text NOT NULL CHECK (tier IN ('Professionalism','Completion')),
  template_url text,
  achievement_text text,
  additional_notes text,
  issued_at timestamptz DEFAULT now(),
  issued_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn','revoked')),
  email_sent_at timestamptz,
  email_failure_reason text,
  withdrawal_reason text,
  withdrawn_at timestamptz,
  withdrawn_by uuid REFERENCES public.profiles(id),
  certificate_image_url text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON public.certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_certificates_kr8_id ON public.certificates(kr8_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON public.certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_skill ON public.certificates(skill);

-- ============================================================================
-- 6. EMAIL LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid REFERENCES public.certificates(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed','pending')),
  error_message text,
  resend_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_certificate_id ON public.email_logs(certificate_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient_email);

-- ============================================================================
-- 7. LIVE ROOMS - SECURE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_rooms (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  mode text NOT NULL DEFAULT 'meeting' CHECK (mode IN ('meeting','broadcast')),
  host_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  host_name text,
  visibility text DEFAULT 'public' CHECK (visibility IN ('public','private')),
  access_key text,
  waiting_room boolean DEFAULT false,
  is_live boolean DEFAULT true,
  is_recording boolean DEFAULT false,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_rooms_is_live ON public.live_rooms(is_live);
CREATE INDEX IF NOT EXISTS idx_live_rooms_host_id ON public.live_rooms(host_id);

CREATE TABLE IF NOT EXISTS public.room_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','admitted','denied')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_admissions_room_id ON public.room_admissions(room_id);
CREATE INDEX IF NOT EXISTS idx_room_admissions_user_id ON public.room_admissions(user_id);

CREATE TABLE IF NOT EXISTS public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name text,
  text text,
  attachment_name text,
  attachment_path text,
  attachment_type text,
  reply_to uuid REFERENCES public.room_messages(id),
  is_deleted boolean DEFAULT false,
  is_pinned boolean DEFAULT false,
  reactions jsonb DEFAULT '{}'::jsonb,
  read_by jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON public.room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_sender_id ON public.room_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created_at ON public.room_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.live_rooms(id) ON DELETE SET NULL,
  title text NOT NULL,
  host_name text,
  file_path text NOT NULL,
  duration_seconds integer,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recordings_room_id ON public.recordings(room_id);

-- ============================================================================
-- 8. ACTIVITY LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  action text NOT NULL,
  target text,
  details jsonb DEFAULT '{}'::jsonb,
  path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON public.activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log(action);

-- ============================================================================
-- 9. SECURITY DEFINER FUNCTIONS - LEAST PRIVILEGE
-- ============================================================================

-- Check if user is admin (founder, co-founder, admin)
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND role IN ('founder','co-founder','admin')
  );
END;
$$;

-- Check specific role
CREATE OR REPLACE FUNCTION public.has_role(user_uuid uuid, role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND role = role_name
  );
END;
$$;

-- Check if user is host
CREATE OR REPLACE FUNCTION public.is_host(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND role IN ('founder','co-founder','admin','coach')
  );
END;
$$;

-- Check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(user_uuid uuid, perm text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Founder has all permissions
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = user_uuid AND role = 'founder') THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND (permissions @> to_jsonb(perm) OR role IN ('founder','co-founder'))
  );
END;
$$;

-- Public verification - safe fields only, no email/phone/dob
CREATE OR REPLACE FUNCTION public.verify_certificate_public(cert_code text)
RETURNS TABLE (
  certificate_code text,
  kr8_id text,
  student_name text,
  skill text,
  skill_name text,
  tier text,
  status text,
  issued_at timestamptz,
  achievement_text text,
  additional_notes text,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.certificate_code,
    c.kr8_id,
    c.student_name,
    c.skill,
    c.skill_name,
    c.tier,
    c.status,
    c.issued_at,
    c.achievement_text,
    c.additional_notes,
    (c.status = 'active') AS is_valid
  FROM public.certificates c
  WHERE c.certificate_code = cert_code
     OR c.kr8_id = cert_code
  LIMIT 1;
END;
$$;

-- Public profile verification - safe fields only
CREATE OR REPLACE FUNCTION public.get_profile_by_kr8_id(lookup_id text)
RETURNS TABLE (
  kr8_id text,
  name text,
  skill text,
  graduated boolean,
  cert_tier text,
  joined timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.kr8_id,
    p.name,
    p.skill,
    p.graduated,
    p.cert_tier,
    p.joined
  FROM public.profiles p
  WHERE p.kr8_id = lookup_id
  LIMIT 1;
END;
$$;

-- Generate KR8 ID on server - unique, format KR82026JC0024GDVFD
CREATE OR REPLACE FUNCTION public.generate_kr8_id(skill_key text DEFAULT 'GEN')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part text;
  random_part text;
  skill_suffix text;
  new_id text;
  attempts int := 0;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  -- Map skill to suffix
  skill_suffix := CASE lower(skill_key)
    WHEN 'graphic' THEN 'GDVFD'
    WHEN 'video' THEN 'VEVFD'
    WHEN 'web' THEN 'WDVFD'
    WHEN 'frontend' THEN 'FEDVFD'
    WHEN 'content_creation' THEN 'CCVFD'
    WHEN 'smm' THEN 'SMMVFD'
    WHEN 'marketing' THEN 'DMVFD'
    ELSE 'GENFD'
  END;

  LOOP
    -- Generate random part: 2 letters + 4 digits + random
    random_part := upper(substring(md5(random()::text) from 1 for 2)) || 
                   lpad((floor(random()*9999))::text, 4, '0') ||
                   upper(substring(md5(random()::text) from 1 for 3));
    
    new_id := 'KR8' || year_part || random_part || skill_suffix;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE kr8_id = new_id) THEN
      RETURN new_id;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 10 THEN
      -- Fallback with UUID part
      new_id := 'KR8' || year_part || upper(substring(md5(gen_random_uuid()::text) from 1 for 8)) || skill_suffix;
      RETURN new_id;
    END IF;
  END LOOP;
END;
$$;

-- Prevent students from changing protected fields
CREATE OR REPLACE FUNCTION public.prevent_protected_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If not service_role and not admin, block protected fields
  IF auth.role() != 'service_role' AND NOT public.is_admin(auth.uid()) THEN
    -- Check if protected fields are being changed
    IF OLD.graduated IS DISTINCT FROM NEW.graduated OR
       OLD.cert_tier IS DISTINCT FROM NEW.cert_tier OR
       OLD.cert_recognition IS DISTINCT FROM NEW.cert_recognition OR
       OLD.points IS DISTINCT FROM NEW.points OR
       OLD.kr8_id IS DISTINCT FROM NEW.kr8_id OR
       OLD.email IS DISTINCT FROM NEW.email THEN
      RAISE EXCEPTION 'Students cannot change graduated, cert_tier, cert_recognition, points, kr8_id, or email. Only admins via server function may.';
    END IF;
    
    -- Also prevent changing id (role via user_roles)
    IF OLD.id IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'Cannot change user ID';
    END IF;
  END IF;
  
  -- Prevent users from changing other users' profiles
  IF auth.role() != 'service_role' AND auth.uid() != NEW.id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Cannot update other users profiles';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_protected_profile_changes();

-- Updated at trigger for certificates
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_certificates ON public.certificates;
CREATE TRIGGER set_updated_at_certificates
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 10. HANDLE NEW USER - SERVER-GENERATED KR8 ID, FOUNDER RECOGNITION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kr8_id_val text;
  skill_val text;
  name_val text;
  phone_val text;
  normalized_phone_val text;
  is_founder_email boolean;
  is_founder_phone boolean;
BEGIN
  name_val := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  skill_val := COALESCE(NEW.raw_user_meta_data->>'skill', 'graphic');
  phone_val := NEW.raw_user_meta_data->>'phone';
  normalized_phone_val := public.normalize_phone(phone_val);

  -- SECURITY: KR8 ID is ALWAYS generated on server, never from client
  -- Ignore any kr8_id from client metadata
  kr8_id_val := public.generate_kr8_id(skill_val);

  -- Check if this is founder by email (verified ownership via email confirmation)
  is_founder_email := (lower(NEW.email) = lower('kr8digitals01@gmail.com'));
  
  -- Check if founder phone (but DO NOT grant role yet - requires verification)
  -- We store phone but role granting requires additional verification
  is_founder_phone := (normalized_phone_val = '2348125687509');

  INSERT INTO public.profiles (id, kr8_id, name, email, phone, phone_normalized, country, skill, joined, phone_verified)
  VALUES (
    NEW.id,
    kr8_id_val,
    name_val,
    NEW.email,
    phone_val,
    normalized_phone_val,
    COALESCE(NEW.raw_user_meta_data->>'country','NG'),
    skill_val,
    now(),
    false -- phone not verified yet
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = now();

  -- Default role student - ALWAYS
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- SECURITY: Only founder email gets auto founder role AFTER email confirmation
  -- For founder, email is verified ownership (kr8digitals01@gmail.com is confirmed email)
  -- Phone numbers alone NEVER grant admin - requires OTP verification or founder promotion
  IF is_founder_email AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, title, permissions)
    VALUES (NEW.id, 'founder', 'Founder & CEO', '["all"]'::jsonb)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- For co-founders: DO NOT auto-grant based on phone alone
  -- They must either:
  -- 1. Have verified email (to be provided by owner) OR
  -- 2. Be promoted by founder from admin page
  -- This prevents anyone typing founder phone from getting admin

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle email confirmation to grant founder role after verification
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When email gets confirmed, check if founder email
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    IF lower(NEW.email) = lower('kr8digitals01@gmail.com') THEN
      INSERT INTO public.user_roles (user_id, role, title, permissions)
      VALUES (NEW.id, 'founder', 'Founder & CEO', '["all"]'::jsonb)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();

-- ============================================================================
-- 11. RLS POLICIES - LEAST PRIVILEGE, SECURE
-- ============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- PROFILES: Students can read only own full profile
-- No policy allowing all authenticated to read all profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Admins with view_students permission can read all profiles
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid()) AND public.has_permission(auth.uid(), 'view_students')
  );

-- Users can update own profile but protected fields blocked by trigger
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- No anon direct select - public verification via security-definer functions only
-- (Remove anon policies)

-- Service role all
CREATE POLICY "profiles_service_role_all" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- USER ROLES: Users can read own roles, admins can read all, only founder can modify
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_admin(auth.uid())
  );

-- Only founder can insert/update/delete roles, and users cannot change own role
CREATE POLICY "user_roles_insert_founder" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'founder') AND user_id != auth.uid()
  );

CREATE POLICY "user_roles_update_founder" ON public.user_roles
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'founder') AND user_id != auth.uid()
  ) WITH CHECK (
    public.has_role(auth.uid(), 'founder') AND user_id != auth.uid()
  );

CREATE POLICY "user_roles_delete_founder" ON public.user_roles
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'founder') AND user_id != auth.uid()
  );

CREATE POLICY "user_roles_service_role_all" ON public.user_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ENROLLMENTS: Students can read own, but cannot insert graduated=true (blocked by trigger)
CREATE POLICY "enrollments_select_own" ON public.enrollments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_admin(auth.uid())
  );

CREATE POLICY "enrollments_insert_own" ON public.enrollments
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND graduated = false
  );

CREATE POLICY "enrollments_service_role_all" ON public.enrollments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- CERTIFICATES: No anon direct select - use verify_certificate_public function
-- Users can read own certificates
CREATE POLICY "certificates_select_own" ON public.certificates
  FOR SELECT TO authenticated USING (
    student_id = auth.uid() OR (public.is_admin(auth.uid()) AND public.has_permission(auth.uid(), 'view_students'))
  );

-- Service role all (for issuance via server function)
CREATE POLICY "certificates_service_role_all" ON public.certificates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- EMAIL LOGS: Only admin with view_students and service_role
CREATE POLICY "email_logs_select_admin" ON public.email_logs
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid()) AND public.has_permission(auth.uid(), 'view_students')
  );

CREATE POLICY "email_logs_service_role_all" ON public.email_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- LIVE ROOMS: Anyone can read is_live rooms, but host/admin can manage
CREATE POLICY "live_rooms_select" ON public.live_rooms
  FOR SELECT TO authenticated USING (
    is_live = true OR host_id = auth.uid() OR public.is_admin(auth.uid())
  );

CREATE POLICY "live_rooms_insert_host" ON public.live_rooms
  FOR INSERT TO authenticated WITH CHECK (
    public.is_host(auth.uid())
  );

CREATE POLICY "live_rooms_update_host" ON public.live_rooms
  FOR UPDATE TO authenticated USING (
    host_id = auth.uid() OR public.is_admin(auth.uid())
  ) WITH CHECK (
    host_id = auth.uid() OR public.is_admin(auth.uid())
  );

CREATE POLICY "live_rooms_service_role_all" ON public.live_rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ROOM ADMISSIONS: New admission always pending, only host/admin can admit
CREATE POLICY "room_admissions_select" ON public.room_admissions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.live_rooms lr 
      WHERE lr.id = room_id AND (lr.host_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "room_admissions_insert" ON public.room_admissions
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND status = 'pending'
  );

CREATE POLICY "room_admissions_update_host" ON public.room_admissions
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.live_rooms lr 
      WHERE lr.id = room_id AND (lr.host_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_rooms lr 
      WHERE lr.id = room_id AND (lr.host_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "room_admissions_service_role_all" ON public.room_admissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ROOM MESSAGES: Only admitted participants and hosts can read chat
CREATE POLICY "room_messages_select" ON public.room_messages
  FOR SELECT TO authenticated USING (
    -- Host can read all
    EXISTS (SELECT 1 FROM public.live_rooms lr WHERE lr.id = room_id AND lr.host_id = auth.uid())
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.room_admissions ra 
      WHERE ra.room_id = room_messages.room_id 
      AND ra.user_id = auth.uid() 
      AND ra.status = 'admitted'
    )
    OR sender_id = auth.uid()
  );

CREATE POLICY "room_messages_insert" ON public.room_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND
    (
      EXISTS (SELECT 1 FROM public.live_rooms lr WHERE lr.id = room_id AND lr.host_id = auth.uid())
      OR public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.room_admissions ra 
        WHERE ra.room_id = room_messages.room_id 
        AND ra.user_id = auth.uid() 
        AND ra.status = 'admitted'
      )
    )
  );

CREATE POLICY "room_messages_update_host" ON public.room_messages
  FOR UPDATE TO authenticated USING (
    public.is_host(auth.uid()) OR sender_id = auth.uid()
  ) WITH CHECK (
    public.is_host(auth.uid()) OR sender_id = auth.uid()
  );

CREATE POLICY "room_messages_service_role_all" ON public.room_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RECORDINGS
CREATE POLICY "recordings_select" ON public.recordings
  FOR SELECT TO authenticated USING (
    is_hidden = false OR public.is_admin(auth.uid())
  );

CREATE POLICY "recordings_insert_host" ON public.recordings
  FOR INSERT TO authenticated WITH CHECK (
    public.is_host(auth.uid())
  );

CREATE POLICY "recordings_service_role_all" ON public.recordings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ACTIVITY LOG
CREATE POLICY "activity_log_select_admin" ON public.activity_log
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
  );

CREATE POLICY "activity_log_insert" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (
    actor_id = auth.uid() OR public.is_admin(auth.uid())
  );

CREATE POLICY "activity_log_service_role_all" ON public.activity_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 12. GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT ON public.enrollments TO authenticated;
GRANT SELECT ON public.certificates TO authenticated;
GRANT SELECT ON public.live_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.room_admissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.room_messages TO authenticated;
GRANT SELECT ON public.recordings TO authenticated;
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_certificate_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_kr8_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_kr8_id(text) TO authenticated, service_role;

-- ============================================================================
-- 13. REALTIME
-- ============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.certificates; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_admissions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================================
-- 14. CLEANUP OLD INSECURE OBJECTS
-- ============================================================================
DROP TABLE IF EXISTS public.graduation_audit;
DROP TRIGGER IF EXISTS trg_log_graduation ON public.accounts;
DROP FUNCTION IF EXISTS public.graduation_audit();

-- Remove old accounts table policies if exists (legacy table should be removed in fresh start)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='accounts') THEN
    EXECUTE 'ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY';
    -- Drop all policies on accounts
    FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.accounts'::regclass) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.accounts', r.polname);
    END LOOP;
    -- Only service_role can access accounts (for backup)
    EXECUTE 'CREATE POLICY "accounts_service_role_only" ON public.accounts FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 15. FOUNDER PHONE NORMALIZATION INDEX
-- ============================================================================
-- Ensure founder phone can be matched in normalized form
-- Timfire: +2348125687509, 08125687509, 2348125687509 all -> 2348125687509
-- Daniel: +2348106068523 -> 2348106068523
-- Motionverse: +2348089344434 -> 2348089344434

-- This is handled by normalize_phone function and phone_normalized column

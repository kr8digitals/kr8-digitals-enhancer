-- Round 4: Skills & Links, Site Settings, WebAuthn Passkeys, Password Reset Limits, Blog extras
-- Idempotent, safe to run multiple times
-- Do not modify existing tables without migration - this file creates new tables only or adds if not exists

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SKILL_SETTINGS - replaces hardcoded DEFAULT_SKILLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.skill_settings (
  skill_key text PRIMARY KEY,
  name text NOT NULL,
  reg_open boolean NOT NULL DEFAULT true,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  whatsapp_url text,
  suffix text,
  snippet text,
  icon text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns if table existed with fewer columns
DO $$ BEGIN
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS whatsapp_url text;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS suffix text;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS snippet text;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS icon text;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS name text;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS reg_open boolean DEFAULT true;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS available boolean DEFAULT true;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
  ALTER TABLE public.skill_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Seed default skills if not exists (idempotent)
INSERT INTO public.skill_settings (skill_key, name, reg_open, available, sort_order, whatsapp_url, suffix, snippet, icon)
VALUES
  ('graphic', 'Graphic Design', true, true, 1, 'https://chat.whatsapp.com/G5mSP8JeelfELvnljpgSJ8', 'GDVFD', '8-week graphic design.', 'palette'),
  ('video', 'Video Editing & Animation', true, true, 2, 'https://chat.whatsapp.com/GYVKMA6CLPC2mnG356u8jT', 'VEVFD', '8-week video editing.', 'video'),
  ('web', 'Website Development', true, true, 3, 'https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v', 'WDVFD', '8-week website development.', 'code'),
  ('frontend', 'Front-End Development', true, true, 4, 'https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v', 'FEDVFD', '8-week frontend.', 'code'),
  ('content_creation', 'Content Creation', true, true, 5, 'https://chat.whatsapp.com/KRnuYK0hIhh0lobi7Tl7Kz', 'CCVFD', '8-week creator programme.', 'video'),
  ('smm', 'Social Media Management', true, true, 6, 'https://chat.whatsapp.com/KRnuYK0hIhh0lobi7Tl7Kz', 'SMMVFD', '8-week SMM.', 'mobile'),
  ('marketing', 'Digital Marketing', true, true, 7, 'https://chat.whatsapp.com/Fah586y8c26KkUfRhAe8i6', 'DMVFD', '8-week marketing.', 'chart')
ON CONFLICT (skill_key) DO NOTHING;

-- RLS for skill_settings
ALTER TABLE public.skill_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.skill_settings'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.skill_settings', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Visitors (anon) can read only limited columns: skill_key, name, reg_open, available, sort_order
-- We implement via two policies: anon can select, but we will filter columns in code.
-- For simplicity, allow anon to read all, but client will only select limited columns.
-- More secure: create view or use RLS with column-level? Postgres RLS can't filter columns easily, so we use policy allowing anon read of reg_open/available.
CREATE POLICY "skill_settings_anon_read" ON public.skill_settings FOR SELECT TO anon USING (true);
CREATE POLICY "skill_settings_auth_read" ON public.skill_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "skill_settings_admin_write" ON public.skill_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "skill_settings_service_all" ON public.skill_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.skill_settings TO anon, authenticated;
GRANT ALL ON public.skill_settings TO service_role;

-- ============================================================================
-- 2. SITE_SETTINGS - social_links, tribe_whatsapp, waitlist_whatsapp, announcement_bar, payment
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Seed defaults
INSERT INTO public.site_settings (key, value)
VALUES
  ('social_links', '[{"key":"youtube","label":"YouTube","href":"https://youtube.com/@kr8digitals","icon":"youtube","enabled":true},{"key":"tiktok","label":"TikTok","href":"https://www.tiktok.com/@kr8digitals","icon":"tiktok","enabled":true},{"key":"instagram","label":"Instagram","href":"https://www.instagram.com/kr8digitals_","icon":"instagram","enabled":true},{"key":"facebook","label":"Facebook","href":"https://www.facebook.com/share/19FLQJ8bok/","icon":"facebook","enabled":true},{"key":"x","label":"X","href":"https://x.com/kr8digitals","icon":"x","enabled":true}]'::jsonb),
  ('tribe_whatsapp', '"https://chat.whatsapp.com/DgnBOEd5CfMHV8CTWgPNLH"'::jsonb),
  ('waitlist_whatsapp', '"https://chat.whatsapp.com/DgnBOEd5CfMHV8CTWgPNLH"'::jsonb),
  ('announcement_bar', '{"on":true,"message":"KR8 Cohort Open - Registration Live!"}'::jsonb),
  ('payment', '{"account":"8166552758","bank":"OPay","name":"Kenneth Timothy","advancedPrice":"35000"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.site_settings'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.site_settings', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "site_settings_anon_read" ON public.site_settings FOR SELECT TO anon USING (true);
CREATE POLICY "site_settings_auth_read" ON public.site_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_settings_admin_write" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "site_settings_service_all" ON public.site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

-- ============================================================================
-- 3. WEBAUTHN CREDENTIALS - Passkeys
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id text UNIQUE NOT NULL,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] DEFAULT '{}',
  device_label text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  backed_up boolean DEFAULT false,
  aaguid text
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential ON public.webauthn_credentials(credential_id);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.webauthn_credentials'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.webauthn_credentials', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "webauthn_own_read" ON public.webauthn_credentials FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "webauthn_own_write" ON public.webauthn_credentials FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "webauthn_service_all" ON public.webauthn_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;

-- ============================================================================
-- 4. PASSWORD RESET LOGS - 60 day limit
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.password_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','completed','blocked')),
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_email ON public.password_reset_logs(email);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON public.password_reset_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_created ON public.password_reset_logs(created_at DESC);

ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.password_reset_logs'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.password_reset_logs', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Only service_role can read/write directly
CREATE POLICY "pwd_reset_service_all" ON public.password_reset_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Authenticated users cannot directly access, must go through server function
-- But allow own email check via function only

GRANT ALL ON public.password_reset_logs TO service_role;

-- Function to check if password reset allowed - service_role only
CREATE OR REPLACE FUNCTION public.password_reset_status(p_email text)
RETURNS TABLE (allowed boolean, next_allowed_at timestamptz, last_reset_at timestamptz, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_completed timestamptz;
  days_since integer;
BEGIN
  -- Only service_role can call this, or admin
  IF NOT (auth.role() = 'service_role' OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only service_role can check password reset status';
  END IF;

  SELECT completed_at INTO last_completed
  FROM public.password_reset_logs
  WHERE lower(email) = lower(p_email) AND status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 1;

  IF last_completed IS NULL THEN
    RETURN QUERY SELECT true, NULL::timestamptz, NULL::timestamptz, 'no previous reset'::text;
    RETURN;
  END IF;

  days_since := EXTRACT(DAY FROM (now() - last_completed))::int;

  IF days_since >= 60 THEN
    RETURN QUERY SELECT true, NULL::timestamptz, last_completed, 'allowed after 60 days'::text;
  ELSE
    RETURN QUERY SELECT false, (last_completed + interval '60 days'), last_completed, 'PASSWORD_RESET_LIMIT: reset used within 60 days'::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.password_reset_status(text) TO service_role;

-- Function to log password reset request
CREATE OR REPLACE FUNCTION public.log_password_reset(p_email text, p_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.password_reset_logs (email, user_id, status)
  VALUES (p_email, p_user_id, 'requested')
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Trigger to block second completed reset within 60 days at DB level
CREATE OR REPLACE FUNCTION public.prevent_frequent_password_reset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_completed timestamptz;
BEGIN
  IF NEW.status = 'completed' THEN
    SELECT completed_at INTO last_completed
    FROM public.password_reset_logs
    WHERE lower(email) = lower(NEW.email) AND status = 'completed' AND id != NEW.id
    ORDER BY completed_at DESC
    LIMIT 1;

    IF last_completed IS NOT NULL AND last_completed > now() - interval '60 days' THEN
      RAISE EXCEPTION 'PASSWORD_RESET_LIMIT: Password reset can only be used once every 60 days. Next allowed at %', (last_completed + interval '60 days');
    END IF;
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_pwd_reset_limit ON public.password_reset_logs;
CREATE TRIGGER check_pwd_reset_limit
  BEFORE INSERT OR UPDATE ON public.password_reset_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_frequent_password_reset();

-- ============================================================================
-- 5. BLOG EXTRAS - likes, comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blog_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_likes_post ON public.blog_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON public.blog_comments(post_id);

ALTER TABLE public.blog_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid IN ('public.blog_likes'::regclass,'public.blog_comments'::regclass)) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.tbl::regclass); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "blog_likes_read" ON public.blog_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_likes_write" ON public.blog_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "blog_likes_service" ON public.blog_likes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "blog_comments_read" ON public.blog_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_comments_write" ON public.blog_comments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "blog_comments_service" ON public.blog_comments FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.blog_likes TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.blog_likes TO authenticated;
GRANT ALL ON public.blog_likes TO service_role;

GRANT SELECT ON public.blog_comments TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.blog_comments TO authenticated;
GRANT ALL ON public.blog_comments TO service_role;

-- ============================================================================
-- 6. UPDATE EXISTING TABLES FOR ROUND 4 REQUIREMENTS
-- ============================================================================

-- direct_messages: ensure columns are correct (sender_id, recipient_id, text, read_at)
DO $$ BEGIN
  ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
  ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS recipient_id uuid;
  -- Migrate old read boolean to read_at if needed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='direct_messages' AND column_name='read') THEN
    -- Keep both for compatibility
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- notifications: ensure read boolean and own rows
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- suspended_accounts: ensure status, appeal fields
DO $$ BEGIN
  ALTER TABLE public.suspended_accounts ADD COLUMN IF NOT EXISTS appeal_text text;
  ALTER TABLE public.suspended_accounts ADD COLUMN IF NOT EXISTS appeal_at timestamptz;
  ALTER TABLE public.suspended_accounts ADD COLUMN IF NOT EXISTS status text DEFAULT 'suspended';
  ALTER TABLE public.suspended_accounts ADD COLUMN IF NOT EXISTS restored_at timestamptz;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- blog_posts: ensure published column
DO $$ BEGIN
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS published boolean DEFAULT true;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- testimonials: ensure approved
DO $$ BEGIN
  ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- gallery_items: ensure approved
DO $$ BEGIN
  ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Update certificates to allow edited name
DO $$ BEGIN
  ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS student_name_edited text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Live rooms: add type column for video/audio choice
DO $$ BEGIN
  ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS room_type text DEFAULT 'video' CHECK (room_type IN ('video','audio'));
  ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS audio_only boolean DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 7. GRANTS AND POLLING SAFETY - Ensure functions have correct grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_activity(integer) TO anon, authenticated;

-- Ensure anon can read announcements, blog, etc but not whole tables via limit
-- (App will poll every 60-120s, not realtime whole tables)

-- Update updated_at triggers for skill_settings and site_settings
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_skill ON public.skill_settings;
CREATE TRIGGER set_updated_at_skill BEFORE UPDATE ON public.skill_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_site ON public.site_settings;
CREATE TRIGGER set_updated_at_site BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 8. FIX PROFILES RLS FOR KR8_ID SIGN-IN RESOLUTION (server only)
-- ============================================================================
-- Ensure service_role can read profiles for KR8 ID resolution
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;

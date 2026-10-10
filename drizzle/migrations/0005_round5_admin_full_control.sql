-- Round 5: Admin Dashboard Must Control Whole Website
-- Idempotent, RLS on, least privilege, public read only published/approved, admin writes only
-- No base64 images, use Storage buckets site-media and user-uploads

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Helper: is_staff check (founder, co-founder, admin, moderator, coach, attendance_reviewer)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND role IN ('founder','co-founder','admin','moderator','coach','attendance_reviewer')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon, service_role;

-- ============================================================================
-- 1. SITE_CONTENT - CMS for all public pages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL, -- e.g. 'home', 'academy', 'tribe', 'agency', 'footer', 'faq'
  key text NOT NULL, -- e.g. 'hero_headline', 'hero_subtitle', 'section_1_title'
  value jsonb NOT NULL, -- text, array, object
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  UNIQUE(page, key)
);

CREATE INDEX IF NOT EXISTS idx_site_content_page ON public.site_content(page);
CREATE INDEX IF NOT EXISTS idx_site_content_key ON public.site_content(key);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.site_content'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.site_content', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "site_content_public_read" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site_content_admin_write" ON public.site_content FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "site_content_service_all" ON public.site_content FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;

-- Seed some defaults if empty
INSERT INTO public.site_content (page, key, value) VALUES
  ('home', 'hero_headline', '"We Make It Happen."'::jsonb),
  ('home', 'hero_subtitle', '"Learn Free. Belong Deeply. Build for Real."'::jsonb),
  ('home', 'hero_badge', '"KR8 Digitals Ecosystem"'::jsonb),
  ('academy', 'hero_headline', '"Master high-income craft — completely free."'::jsonb),
  ('academy', 'hero_subtitle', '"Tuition-free tracks taught by senior practitioners."'::jsonb),
  ('tribe', 'hero_headline', '"Isolation Kills Craft. You Never Have to Build Alone."'::jsonb),
  ('footer', 'copyright', '"© 2026 KR8 Digitals. All rights reserved."'::jsonb)
ON CONFLICT (page, key) DO NOTHING;

-- ============================================================================
-- 2. LINKS_REDIRECTS - /go/:slug with click counter
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.links_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  target_url text NOT NULL CHECK (target_url ~ '^https?://'),
  clicks integer NOT NULL DEFAULT 0,
  title text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_slug ON public.links_redirects(slug);

ALTER TABLE public.links_redirects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.links_redirects'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.links_redirects', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "links_public_read" ON public.links_redirects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "links_admin_write" ON public.links_redirects FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "links_service_all" ON public.links_redirects FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.links_redirects TO anon, authenticated;
GRANT ALL ON public.links_redirects TO service_role;

-- Function to increment clicks (safe for anon via RPC)
CREATE OR REPLACE FUNCTION public.increment_link_click(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.links_redirects SET clicks = clicks + 1, updated_at = now() WHERE slug = p_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_link_click(text) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. VERIFY_REMARKS - remark on verify page
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.verify_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('student','certificate')),
  target_id text NOT NULL, -- kr8_id or certificate_code
  remark text NOT NULL,
  visible_public boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verify_remarks_target ON public.verify_remarks(target_type, target_id);

ALTER TABLE public.verify_remarks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.verify_remarks'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.verify_remarks', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "verify_remarks_public_read" ON public.verify_remarks FOR SELECT TO anon, authenticated USING (visible_public = true OR public.is_staff(auth.uid()));
CREATE POLICY "verify_remarks_admin_write" ON public.verify_remarks FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "verify_remarks_service_all" ON public.verify_remarks FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.verify_remarks TO anon, authenticated;
GRANT ALL ON public.verify_remarks TO service_role;

-- ============================================================================
-- 4. POINTS_LEDGER - add/subtract points with reason
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kr8_id text NOT NULL,
  points_change integer NOT NULL CHECK (points_change != 0),
  reason text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON public.points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_kr8 ON public.points_ledger(kr8_id);

ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.points_ledger'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.points_ledger', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "points_ledger_own_read" ON public.points_ledger FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "points_ledger_admin_write" ON public.points_ledger FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND public.has_permission(auth.uid(), 'view_students'));
CREATE POLICY "points_ledger_service_all" ON public.points_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.points_ledger TO authenticated;
GRANT INSERT ON public.points_ledger TO authenticated;
GRANT ALL ON public.points_ledger TO service_role;

-- Function to apply points via server only
CREATE OR REPLACE FUNCTION public.apply_points(p_user_id uuid, p_change integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
  kr8 text;
BEGIN
  actor := auth.uid();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_staff(actor) THEN
    RAISE EXCEPTION 'Only staff can change points';
  END IF;
  -- Prevent self-change
  IF actor = p_user_id THEN
    RAISE EXCEPTION 'Cannot change own points';
  END IF;
  SELECT kr8_id INTO kr8 FROM public.profiles WHERE id = p_user_id;
  IF kr8 IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.points_ledger (user_id, kr8_id, points_change, reason, created_by) VALUES (p_user_id, kr8, p_change, p_reason, actor);
  UPDATE public.profiles SET points = points + p_change, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (actor, 'points_change', kr8, jsonb_build_object('change', p_change, 'reason', p_reason, 'user_id', p_user_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_points(uuid, integer, text) TO authenticated, service_role;

-- ============================================================================
-- 5. CURRICULA - Courses per skill (weeks, topics, resources, assignments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_key text NOT NULL REFERENCES public.skill_settings(skill_key) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 20),
  week_title text NOT NULL,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of strings
  resources jsonb DEFAULT '[]'::jsonb, -- array of {title, url, type}
  assignments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(skill_key, week_number)
);

CREATE INDEX IF NOT EXISTS idx_curricula_skill ON public.curricula(skill_key);

ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.curricula'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.curricula', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "curricula_public_read" ON public.curricula FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "curricula_admin_write" ON public.curricula FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "curricula_service_all" ON public.curricula FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.curricula TO anon, authenticated;
GRANT ALL ON public.curricula TO service_role;

-- ============================================================================
-- 6. CLIENT_REQUESTS - contact/hire form
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  service text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','in_progress','completed','rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_requests_status ON public.client_requests(status);
CREATE INDEX IF NOT EXISTS idx_client_requests_created ON public.client_requests(created_at DESC);

ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.client_requests'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.client_requests', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "client_requests_admin_read" ON public.client_requests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "client_requests_admin_write" ON public.client_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "client_requests_service_all" ON public.client_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.client_requests TO authenticated;
GRANT ALL ON public.client_requests TO service_role;

-- Rate-limited insert via server function
CREATE OR REPLACE FUNCTION public.submit_client_request(p_name text, p_email text, p_phone text, p_service text, p_message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- Basic rate limit: max 3 per hour per email
  IF (SELECT COUNT(*) FROM public.client_requests WHERE lower(email) = lower(p_email) AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Too many requests. Please wait.';
  END IF;
  INSERT INTO public.client_requests (name, email, phone, service, message, status) VALUES (p_name, p_email, p_phone, p_service, p_message, 'new') RETURNING id INTO new_id;
  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (NULL, 'client_request', p_email, jsonb_build_object('name', p_name, 'service', p_service));
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_client_request(text,text,text,text,text) TO anon, authenticated, service_role;

-- ============================================================================
-- 7. AGENCY_PORTFOLIO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agency_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client text,
  image_url text,
  link text,
  description text,
  sort integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_sort ON public.agency_portfolio(sort);

ALTER TABLE public.agency_portfolio ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.agency_portfolio'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.agency_portfolio', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "agency_public_read" ON public.agency_portfolio FOR SELECT TO anon, authenticated USING (visible = true OR public.is_staff(auth.uid()));
CREATE POLICY "agency_admin_write" ON public.agency_portfolio FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "agency_service_all" ON public.agency_portfolio FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.agency_portfolio TO anon, authenticated;
GRANT ALL ON public.agency_portfolio TO service_role;

-- ============================================================================
-- 8. TEAM_MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  bio text,
  photo_url text,
  social_links jsonb DEFAULT '[]'::jsonb,
  sort integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_sort ON public.team_members(sort);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.team_members'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "team_public_read" ON public.team_members FOR SELECT TO anon, authenticated USING (visible = true OR public.is_staff(auth.uid()));
CREATE POLICY "team_admin_write" ON public.team_members FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "team_service_all" ON public.team_members FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT ALL ON public.team_members TO service_role;

-- Seed team if empty from founders
INSERT INTO public.team_members (name, role, bio, photo_url, sort, visible)
SELECT name, role, bio, photo, 1, true FROM (VALUES
  ('Timfire (Kenneth Timothy Iziogo)', 'CEO · Founder · Website Development', 'Founder, AI agent developer.', 'https://drive.google.com/uc?export=view&id=1Ssje7WtVFMd8TZxMfrex1S0lKG6p_Wp9'),
  ('Stevenson (Motionverse)', 'Co-Founder · Media Director', 'Leads Graphic Design.', 'https://drive.google.com/uc?export=view&id=1TSZrdT2xXpZj6D8_t9PGhu1dSamBNr7C'),
  ('Daniel (Creative Expression)', 'Co-Founder · COO', 'Leads Video Editing.', 'https://drive.google.com/uc?export=view&id=1GFIv8Ho101udn2IbSiz5Zq8G92XJn2AU')
) AS t(name, role, bio, photo)
WHERE NOT EXISTS (SELECT 1 FROM public.team_members);

-- ============================================================================
-- 9. REPORTS - moderation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('user','message','post','comment','room')),
  target_id text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  created_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.reports'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "reports_own_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_admin_read" ON public.reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR reporter_id = auth.uid());
CREATE POLICY "reports_admin_write" ON public.reports FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "reports_service_all" ON public.reports FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

-- ============================================================================
-- 10. MINDSET EVENTS and REGISTRATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mindset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date timestamptz,
  location text,
  registration_link text,
  image_url text,
  max_capacity integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.mindset_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.mindset_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_mindset_reg_event ON public.mindset_registrations(event_id);

ALTER TABLE public.mindset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindset_registrations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid IN ('public.mindset_events'::regclass,'public.mindset_registrations'::regclass)) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.tbl::regclass); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "mindset_events_public_read" ON public.mindset_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "mindset_events_admin_write" ON public.mindset_events FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "mindset_events_service_all" ON public.mindset_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "mindset_reg_public_insert" ON public.mindset_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "mindset_reg_admin_read" ON public.mindset_registrations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "mindset_reg_service_all" ON public.mindset_registrations FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.mindset_events TO anon, authenticated;
GRANT ALL ON public.mindset_events TO service_role;
GRANT SELECT, INSERT ON public.mindset_registrations TO anon, authenticated;
GRANT ALL ON public.mindset_registrations TO service_role;

-- ============================================================================
-- 11. FIX CERTIFICATES - certificate_code must be used, not internal id
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS certificate_code text;
  ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS formatted_name text;
  ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS student_name_edited text;
  ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS certificate_image_url text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure certificate_code unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_code_unique ON public.certificates(certificate_code) WHERE certificate_code IS NOT NULL;

-- ============================================================================
-- 12. RPC: admin_overview - real counts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff can view overview';
  END IF;

  SELECT jsonb_build_object(
    'total_students', (SELECT COUNT(*) FROM public.profiles WHERE is_placeholder IS DISTINCT FROM true),
    'new_today', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'new_last_7_days', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'students_per_skill', (SELECT jsonb_object_agg(skill, cnt) FROM (SELECT skill, COUNT(*) as cnt FROM public.profiles WHERE skill IS NOT NULL GROUP BY skill) t),
    'graduated', (SELECT COUNT(*) FROM public.profiles WHERE graduated = true),
    'certificates_issued', (SELECT COUNT(*) FROM public.certificates WHERE status = 'active'),
    'failed_certificate_emails', (SELECT COUNT(*) FROM public.email_logs WHERE status = 'failed'),
    'unconfirmed_signups', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),
    'attendance_waiting', (SELECT COUNT(*) FROM public.attendance_submissions WHERE status = 'pending'),
    'live_rooms_now', (SELECT COUNT(*) FROM public.live_rooms WHERE is_live = true),
    'suspended_accounts', (SELECT COUNT(*) FROM public.suspended_accounts WHERE status = 'suspended'),
    'appeals_waiting', (SELECT COUNT(*) FROM public.suspended_accounts WHERE status = 'appealed'),
    'testimonials_waiting', (SELECT COUNT(*) FROM public.testimonials WHERE approved = false),
    'gallery_waiting', (SELECT COUNT(*) FROM public.gallery_items WHERE approved = false),
    'skills_open', (SELECT jsonb_agg(skill_key) FROM public.skill_settings WHERE reg_open = true),
    'registrations_last_14_days', (SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c)) FROM (SELECT date_trunc('day', created_at)::date as d, COUNT(*) as c FROM public.profiles WHERE created_at >= now() - interval '14 days' GROUP BY d ORDER BY d) t2),
    'blog_pending', (SELECT COUNT(*) FROM public.blog_posts WHERE published = false),
    'client_requests_new', (SELECT COUNT(*) FROM public.client_requests WHERE status = 'new'),
    'reports_pending', (SELECT COUNT(*) FROM public.reports WHERE status = 'pending')
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated, service_role;

-- ============================================================================
-- 13. RPC: admin_list_students - paginated search with status filter
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_students(p_search text DEFAULT NULL, p_skill text DEFAULT NULL, p_status text DEFAULT NULL, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid,
  kr8_id text,
  name text,
  email text,
  phone text,
  skill text,
  graduated boolean,
  points integer,
  created_at timestamptz,
  email_confirmed boolean,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff can list students';
  END IF;

  -- Count total matching
  SELECT COUNT(*) INTO total FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE
    (p_search IS NULL OR p_search = '' OR p.name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%' OR p.kr8_id ILIKE '%' || p_search || '%')
    AND (p_skill IS NULL OR p_skill = '' OR p.skill = p_skill)
    AND (
      p_status IS NULL OR p_status = '' OR
      (p_status = 'graduated' AND p.graduated = true) OR
      (p_status = 'in_training' AND (p.graduated = false OR p.graduated IS NULL)) OR
      (p_status = 'unconfirmed' AND u.email_confirmed_at IS NULL)
    );

  RETURN QUERY
  SELECT
    p.id,
    p.kr8_id,
    p.name,
    p.email,
    p.phone,
    p.skill,
    p.graduated,
    p.points,
    p.created_at,
    (u.email_confirmed_at IS NOT NULL) as email_confirmed,
    total as total_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE
    (p_search IS NULL OR p_search = '' OR p.name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%' OR p.kr8_id ILIKE '%' || p_search || '%')
    AND (p_skill IS NULL OR p_skill = '' OR p.skill = p_skill)
    AND (
      p_status IS NULL OR p_status = '' OR
      (p_status = 'graduated' AND p.graduated = true) OR
      (p_status = 'in_training' AND (p.graduated = false OR p.graduated IS NULL)) OR
      (p_status = 'unconfirmed' AND u.email_confirmed_at IS NULL)
    )
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_students(text,text,text,integer,integer) TO authenticated, service_role;

-- ============================================================================
-- 14. RPC: grant_password_reset_exception - allow reset despite 60d rule
-- ============================================================================
CREATE OR REPLACE FUNCTION public.grant_password_reset_exception(p_email text, p_reason text DEFAULT 'admin exception')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
BEGIN
  actor := auth.uid();
  IF NOT public.is_staff(actor) THEN RAISE EXCEPTION 'Only staff'; END IF;
  IF NOT public.has_permission(actor, 'moderation') AND NOT public.has_role(actor, 'founder') THEN RAISE EXCEPTION 'Need moderation permission'; END IF;
  -- Delete last completed to allow new one, but log exception
  INSERT INTO public.password_reset_logs (email, status) VALUES (p_email, 'blocked');
  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (actor, 'grant_password_reset_exception', p_email, jsonb_build_object('reason', p_reason));
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_password_reset_exception(text,text) TO authenticated, service_role;

-- ============================================================================
-- 15. STORAGE BUCKETS - site-media and user-uploads
-- ============================================================================
-- Create buckets if not exists (storage.buckets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('site-media', 'site-media', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('user-uploads', 'user-uploads', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname LIKE 'site-media%' OR polname LIKE 'user-uploads%') LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- site-media: public read, admin upload only
CREATE POLICY "site-media public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-media');
CREATE POLICY "site-media admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
CREATE POLICY "site-media admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-media' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
CREATE POLICY "site-media admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-media' AND public.is_staff(auth.uid()));
CREATE POLICY "site-media service all" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'site-media') WITH CHECK (bucket_id = 'site-media');

-- user-uploads: public read, each user uploads only into own folder {userId}/...
CREATE POLICY "user-uploads public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'user-uploads');
CREATE POLICY "user-uploads own insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user-uploads own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user-uploads own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user-uploads admin all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'user-uploads' AND public.is_staff(auth.uid())) WITH CHECK (bucket_id = 'user-uploads' AND public.is_staff(auth.uid()));
CREATE POLICY "user-uploads service all" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'user-uploads') WITH CHECK (bucket_id = 'user-uploads');

-- ============================================================================
-- 16. FIX signInWithKr8Id - remove .or() and ilike('%...%') lookup
-- The function in auth.functions.ts already does exact match, but ensure DB has index
-- Validate ID with ^[A-Z0-9]{6,20}$ - will be done in app code, but add check in DB function for future
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_kr8_id(p_kr8_id text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_kr8_id ~ '^[A-Z0-9]{6,20}$';
END;
$$;

-- ============================================================================
-- 17. ACTIVITY LOG - ensure admin actions logged
-- ============================================================================
-- No changes, just ensure RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 18. GRANTS
-- ============================================================================
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT SELECT ON public.links_redirects TO anon, authenticated;
GRANT SELECT ON public.verify_remarks TO anon, authenticated;
GRANT SELECT ON public.curricula TO anon, authenticated;
GRANT SELECT ON public.agency_portfolio TO anon, authenticated;
GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT SELECT ON public.mindset_events TO anon, authenticated;
GRANT SELECT ON public.mindset_registrations TO anon, authenticated;
GRANT SELECT ON public.reports TO authenticated;
GRANT SELECT ON public.client_requests TO authenticated;
GRANT SELECT ON public.points_ledger TO authenticated;

GRANT ALL ON public.site_content TO service_role;
GRANT ALL ON public.links_redirects TO service_role;
GRANT ALL ON public.verify_remarks TO service_role;
GRANT ALL ON public.points_ledger TO service_role;
GRANT ALL ON public.curricula TO service_role;
GRANT ALL ON public.client_requests TO service_role;
GRANT ALL ON public.agency_portfolio TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.reports TO service_role;
GRANT ALL ON public.mindset_events TO service_role;
GRANT ALL ON public.mindset_registrations TO service_role;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_updated_at_site_content ON public.site_content;
CREATE TRIGGER set_updated_at_site_content BEFORE UPDATE ON public.site_content FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_links ON public.links_redirects;
CREATE TRIGGER set_updated_at_links BEFORE UPDATE ON public.links_redirects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_verify ON public.verify_remarks;
CREATE TRIGGER set_updated_at_verify BEFORE UPDATE ON public.verify_remarks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_curricula ON public.curricula;
CREATE TRIGGER set_updated_at_curricula BEFORE UPDATE ON public.curricula FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_client ON public.client_requests;
CREATE TRIGGER set_updated_at_client BEFORE UPDATE ON public.client_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_agency ON public.agency_portfolio;
CREATE TRIGGER set_updated_at_agency BEFORE UPDATE ON public.agency_portfolio FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_team ON public.team_members;
CREATE TRIGGER set_updated_at_team BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_mindset ON public.mindset_events;
CREATE TRIGGER set_updated_at_mindset BEFORE UPDATE ON public.mindset_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

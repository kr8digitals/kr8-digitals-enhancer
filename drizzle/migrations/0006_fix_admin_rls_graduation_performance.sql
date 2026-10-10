-- Round 6: Fix Admin RLS, Graduation, Performance
-- Fixes: attendance_submissions, announcements, blog_posts, testimonials, gallery_items RLS to allow is_staff
-- Fixes: apply_points signature mismatch (5 params vs 3), add overloads
-- Fixes: ensure admin_overview accessible to is_staff, add public counts RPC for home
-- Idempotent

-- ============================================================================
-- 1. Fix is_staff to also include has_permission fallback for granular perms
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
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND permissions IS NOT NULL
    AND jsonb_typeof(permissions) = 'array'
    AND (
      permissions ? 'view_students' OR
      permissions ? 'issue_certificates' OR
      permissions ? 'review_attendance' OR
      permissions ? 'manage_content' OR
      permissions ? 'manage_live' OR
      permissions ? 'moderation' OR
      permissions ? 'manage_links' OR
      permissions ? 'view_finance' OR
      permissions ? 'manage_roles'
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon, service_role;

-- ============================================================================
-- 2. Fix apply_points - support both old 3-param and new 5-param signatures
-- ============================================================================
DROP FUNCTION IF EXISTS public.apply_points(uuid, integer, text);
DROP FUNCTION IF EXISTS public.apply_points(uuid, text, integer, text, uuid);

CREATE OR REPLACE FUNCTION public.apply_points(p_user_id uuid, p_kr8_id text, p_points_change integer, p_reason text, p_actor_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
  kr8 text;
BEGIN
  actor := COALESCE(p_actor_id, auth.uid());
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_staff(actor) THEN
    RAISE EXCEPTION 'Only staff can change points';
  END IF;
  IF actor = p_user_id THEN
    RAISE EXCEPTION 'Cannot change own points';
  END IF;
  -- Resolve kr8_id if not provided
  IF p_kr8_id IS NULL OR p_kr8_id = '' THEN
    SELECT kr8_id INTO kr8 FROM public.profiles WHERE id = p_user_id;
  ELSE
    kr8 := p_kr8_id;
  END IF;
  IF kr8 IS NULL THEN
    SELECT kr8_id INTO kr8 FROM public.profiles WHERE id = p_user_id;
  END IF;
  IF kr8 IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.points_ledger (user_id, kr8_id, points_change, reason, created_by) VALUES (p_user_id, kr8, p_points_change, p_reason, actor);
  UPDATE public.profiles SET points = COALESCE(points,0) + p_points_change, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (actor, 'points_change', kr8, jsonb_build_object('change', p_points_change, 'reason', p_reason, 'user_id', p_user_id));
END;
$$;

-- Overload for old 3-param calls (p_user_id, p_change, p_reason) - for backwards compat
CREATE OR REPLACE FUNCTION public.apply_points(p_user_id uuid, p_change integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_points(p_user_id, NULL::text, p_change, p_reason, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_points(uuid, text, integer, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_points(uuid, integer, text) TO authenticated, service_role;

-- ============================================================================
-- 3. Fix attendance_submissions RLS to allow is_staff (not just is_admin)
-- ============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.attendance_submissions'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.attendance_submissions', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "attendance_own_read" ON public.attendance_submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "attendance_own_insert" ON public.attendance_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_staff_update" ON public.attendance_submissions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "attendance_staff_delete" ON public.attendance_submissions FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "attendance_service_all" ON public.attendance_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. Fix announcements, blog_posts, testimonials, gallery_items RLS to is_staff
-- ============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.announcements'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.announcements', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.blog_posts'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.blog_posts', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.testimonials'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.testimonials', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.gallery_items'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.gallery_items', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "announcements_public_read" ON public.announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "announcements_staff_write" ON public.announcements FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "announcements_service_all" ON public.announcements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "blog_public_read" ON public.blog_posts FOR SELECT TO anon, authenticated USING (published = true OR public.is_staff(auth.uid()));
CREATE POLICY "blog_staff_write" ON public.blog_posts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "blog_service_all" ON public.blog_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "testimonials_public_read" ON public.testimonials FOR SELECT TO anon, authenticated USING (approved = true OR public.is_staff(auth.uid()));
CREATE POLICY "testimonials_staff_write" ON public.testimonials FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "testimonials_service_all" ON public.testimonials FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "gallery_public_read" ON public.gallery_items FOR SELECT TO anon, authenticated USING (approved = true OR public.is_staff(auth.uid()));
CREATE POLICY "gallery_staff_write" ON public.gallery_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "gallery_service_all" ON public.gallery_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. Fix skill_settings RLS to allow is_staff with manage_links
-- ============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.skill_settings'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.skill_settings', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "skill_settings_anon_read" ON public.skill_settings FOR SELECT TO anon USING (true);
CREATE POLICY "skill_settings_auth_read" ON public.skill_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "skill_settings_staff_write" ON public.skill_settings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "skill_settings_service_all" ON public.skill_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. Fix blog_comments, notifications, etc
-- ============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.blog_comments'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.blog_comments', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_comments_public_read" ON public.blog_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_comments_auth_insert" ON public.blog_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "blog_comments_staff_delete" ON public.blog_comments FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "blog_comments_service_all" ON public.blog_comments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 6b. Fix grant_password_reset_exception to accept target_user_id overload
-- ============================================================================
CREATE OR REPLACE FUNCTION public.grant_password_reset_exception(p_target_user_id uuid, p_reason text DEFAULT 'admin exception', p_actor_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
  email_val text;
BEGIN
  actor := COALESCE(p_actor_id, auth.uid());
  IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_staff(actor) THEN RAISE EXCEPTION 'Only staff'; END IF;
  SELECT email INTO email_val FROM public.profiles WHERE id = p_target_user_id;
  IF email_val IS NULL THEN SELECT email INTO email_val FROM auth.users WHERE id = p_target_user_id; END IF;
  IF email_val IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.password_reset_logs (email, status) VALUES (email_val, 'blocked');
  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (actor, 'grant_password_reset_exception', email_val, jsonb_build_object('reason', p_reason, 'target_user_id', p_target_user_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.grant_password_reset_exception(uuid, text, uuid) TO authenticated, service_role;

-- Keep old signature for backwards compat
CREATE OR REPLACE FUNCTION public.grant_password_reset_exception(p_email text, p_reason text DEFAULT 'admin exception')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor uuid;
BEGIN
  actor := auth.uid();
  IF NOT public.is_staff(actor) THEN RAISE EXCEPTION 'Only staff'; END IF;
  INSERT INTO public.password_reset_logs (email, status) VALUES (p_email, 'blocked');
  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (actor, 'grant_password_reset_exception', p_email, jsonb_build_object('reason', p_reason));
END;
$$;
GRANT EXECUTE ON FUNCTION public.grant_password_reset_exception(text, text) TO authenticated, service_role;

-- ============================================================================
-- 7. Public counts RPC for home page (no staff required, fast)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.public_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_students', (SELECT COUNT(*) FROM public.profiles),
    'total_certificates', (SELECT COUNT(*) FROM public.certificates WHERE status = 'active'),
    'total_portfolio', (SELECT COUNT(*) FROM public.agency_portfolio WHERE visible = true),
    'total_announcements', (SELECT COUNT(*) FROM public.announcements),
    'total_blog', (SELECT COUNT(*) FROM public.blog_posts WHERE published = true)
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.public_counts() TO anon, authenticated, service_role;

-- ============================================================================
-- 8. Fix admin_overview to be resilient and include all keys expected by UI
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff can view overview';
  END IF;

  SELECT jsonb_build_object(
    'total_students', COALESCE((SELECT COUNT(*) FROM public.profiles),0),
    'new_today', COALESCE((SELECT COUNT(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),0),
    'new_7d', COALESCE((SELECT COUNT(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),0),
    'new_last_7_days', COALESCE((SELECT COUNT(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),0),
    'students_per_skill', COALESCE((SELECT jsonb_object_agg(skill, cnt) FROM (SELECT skill, COUNT(*) as cnt FROM public.profiles WHERE skill IS NOT NULL GROUP BY skill) t), '{}'::jsonb),
    'graduated', COALESCE((SELECT COUNT(*) FROM public.profiles WHERE graduated = true),0),
    'certificates_issued', COALESCE((SELECT COUNT(*) FROM public.certificates WHERE status = 'active'),0),
    'failed_emails', COALESCE((SELECT COUNT(*) FROM public.email_logs WHERE status = 'failed'),0),
    'failed_certificate_emails', COALESCE((SELECT COUNT(*) FROM public.email_logs WHERE status = 'failed'),0),
    'unconfirmed', COALESCE((SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),0),
    'unconfirmed_signups', COALESCE((SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),0),
    'attendance_waiting', COALESCE((SELECT COUNT(*) FROM public.attendance_submissions WHERE status = 'pending'),0),
    'live_rooms_now', COALESCE((SELECT COUNT(*) FROM public.live_rooms WHERE is_live = true),0),
    'suspended_accounts', COALESCE((SELECT COUNT(*) FROM public.suspended_accounts),0),
    'appeals_waiting', COALESCE((SELECT COUNT(*) FROM public.suspended_accounts WHERE status = 'appealed'),0),
    'testimonials_waiting', COALESCE((SELECT COUNT(*) FROM public.testimonials WHERE approved = false),0),
    'gallery_waiting', COALESCE((SELECT COUNT(*) FROM public.gallery_items WHERE approved = false),0),
    'skills_open', COALESCE((SELECT jsonb_agg(skill_key) FROM public.skill_settings WHERE reg_open = true), '[]'::jsonb),
    'registrations_last_14d', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c)) FROM (SELECT date_trunc('day', created_at)::date as d, COUNT(*) as c FROM public.profiles WHERE created_at >= now() - interval '14 days' GROUP BY d ORDER BY d) t2), '[]'::jsonb),
    'registrations_last_14_days', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c)) FROM (SELECT date_trunc('day', created_at)::date as d, COUNT(*) as c FROM public.profiles WHERE created_at >= now() - interval '14 days' GROUP BY d ORDER BY d) t2), '[]'::jsonb),
    'blog_pending', COALESCE((SELECT COUNT(*) FROM public.blog_posts WHERE published = false),0),
    'client_requests_new', COALESCE((SELECT COUNT(*) FROM public.client_requests WHERE status = 'new'),0),
    'reports_pending', COALESCE((SELECT COUNT(*) FROM public.reports WHERE status = 'pending'),0)
  ) INTO result;

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated, service_role;

-- ============================================================================
-- 9. Ensure certificates table has proper indexes and allow service_role
-- ============================================================================
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.certificates'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.certificates', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

CREATE POLICY "certificates_own_read" ON public.certificates FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "certificates_staff_write_via_service_only" ON public.certificates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "certificates_service_all" ON public.certificates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. Fix links_redirects missing columns is_active
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.links_redirects ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
  ALTER TABLE public.links_redirects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix agency_portfolio missing image column compat (add image as alias via view? Just add column)
DO $$ BEGIN
  ALTER TABLE public.agency_portfolio ADD COLUMN IF NOT EXISTS image text;
  ALTER TABLE public.agency_portfolio ADD COLUMN IF NOT EXISTS client text;
  ALTER TABLE public.agency_portfolio ADD COLUMN IF NOT EXISTS link text;
  ALTER TABLE public.agency_portfolio ADD COLUMN IF NOT EXISTS description text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix team_members missing photo column compat
DO $$ BEGIN
  ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS photo text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix curricula assignments to be text[] compatible
DO $$ BEGIN
  ALTER TABLE public.curricula ADD COLUMN IF NOT EXISTS assignments jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix mindset_events missing columns
DO $$ BEGIN
  ALTER TABLE public.mindset_events ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
  ALTER TABLE public.mindset_events ADD COLUMN IF NOT EXISTS max_attendees integer DEFAULT 100;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 11. Grants
-- ============================================================================
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT SELECT ON public.gallery_items TO anon, authenticated;
GRANT SELECT ON public.skill_settings TO anon, authenticated;
GRANT SELECT ON public.blog_comments TO anon, authenticated;
GRANT SELECT ON public.attendance_submissions TO authenticated;
GRANT SELECT ON public.certificates TO authenticated;
GRANT SELECT ON public.points_ledger TO authenticated;

GRANT ALL ON public.announcements TO service_role;
GRANT ALL ON public.blog_posts TO service_role;
GRANT ALL ON public.testimonials TO service_role;
GRANT ALL ON public.gallery_items TO service_role;
GRANT ALL ON public.skill_settings TO service_role;
GRANT ALL ON public.blog_comments TO service_role;
GRANT ALL ON public.attendance_submissions TO service_role;
GRANT ALL ON public.certificates TO service_role;
GRANT ALL ON public.points_ledger TO service_role;

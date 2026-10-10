-- Round 7: World-class Attendance + Profiles + Live Auto-Marking
-- Enhances attendance_submissions with date/topic/time, admin comments, warnings, auto-marking
-- Adds profile journey, XP, streaks, celebrations

-- ============================================================================
-- 1. Enhance attendance_submissions with world-class fields
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS attendance_date date;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS attendance_topic text;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS attendance_time time;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS admin_comment text;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS admin_warning text;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS proof_image_url text;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS auto_marked boolean DEFAULT false;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS live_room_id text;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS live_purpose text;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS points_awarded integer DEFAULT 0;
  ALTER TABLE public.attendance_submissions ADD COLUMN IF NOT EXISTS feedback text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure type check includes all 4
DO $$ BEGIN
  ALTER TABLE public.attendance_submissions DROP CONSTRAINT IF EXISTS attendance_submissions_type_check;
  ALTER TABLE public.attendance_submissions ADD CONSTRAINT attendance_submissions_type_check CHECK (type IN ('class','assignment','mindset','hangout'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure status check includes warning state (approved with warning is still approved)
DO $$ BEGIN
  ALTER TABLE public.attendance_submissions DROP CONSTRAINT IF EXISTS attendance_submissions_status_check;
  ALTER TABLE public.attendance_submissions ADD CONSTRAINT attendance_submissions_status_check CHECK (status IN ('pending','approved','rejected'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_submissions(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_type_status ON public.attendance_submissions(type, status);
CREATE INDEX IF NOT EXISTS idx_attendance_kr8 ON public.attendance_submissions(kr8_id);
CREATE INDEX IF NOT EXISTS idx_attendance_auto ON public.attendance_submissions(auto_marked);

-- ============================================================================
-- 2. Attendance settings - admin can override open/close per type
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  type text PRIMARY KEY CHECK (type IN ('class','assignment','mindset','hangout')),
  is_open boolean DEFAULT NULL, -- NULL = auto by schedule, true/false = admin override
  message text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

INSERT INTO public.attendance_settings (type, is_open, message) VALUES
  ('class', NULL, 'Auto: Mon/Wed/Fri 9PM-12AM WAT'),
  ('assignment', NULL, 'Auto: Tue/Thu/Sat 12AM-11:59PM WAT'),
  ('mindset', NULL, 'Auto: 1st & 3rd Sundays 7PM-11PM, attendance 10PM-11PM'),
  ('hangout', NULL, 'Auto: Last Sunday 7PM-11PM, attendance 10PM-11PM')
ON CONFLICT (type) DO NOTHING;

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.attendance_settings'::regclass) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.attendance_settings', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
CREATE POLICY "attendance_settings_public_read" ON public.attendance_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "attendance_settings_staff_write" ON public.attendance_settings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "attendance_settings_service_all" ON public.attendance_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.attendance_settings TO anon, authenticated;
GRANT ALL ON public.attendance_settings TO service_role;

-- ============================================================================
-- 3. Profiles enhancements for journey, streaks, celebrations
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_attendance_date date;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_class_attendance integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_assignment_attendance integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_mindset_attendance integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_hangout_attendance integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS journey_milestones jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celebration_message text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_placeholder boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS attendance_accepted integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS submissions integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referrals integer DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS graduated boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cert_tier text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cert_recognition text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 4. Live attendance auto-marking function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_mark_live_attendance(
  p_user_id uuid,
  p_kr8_id text,
  p_live_room_id text,
  p_live_purpose text,
  p_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  existing_id uuid;
BEGIN
  -- Check if already marked for this room and user today
  SELECT id INTO existing_id FROM public.attendance_submissions
  WHERE user_id = p_user_id AND live_room_id = p_live_room_id AND type = p_type AND attendance_date = CURRENT_DATE
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  -- Check if already has pending/approved for same type today
  SELECT id INTO existing_id FROM public.attendance_submissions
  WHERE user_id = p_user_id AND type = p_type AND attendance_date = CURRENT_DATE AND status IN ('pending','approved')
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO public.attendance_submissions (
    user_id, kr8_id, type, status, auto_marked, live_room_id, live_purpose,
    attendance_date, attendance_topic, proof_text, points_awarded
  ) VALUES (
    p_user_id, p_kr8_id, p_type, 'approved', true, p_live_room_id, p_live_purpose,
    CURRENT_DATE, p_live_purpose, 'Auto-marked via live stream participation', 15
  ) RETURNING id INTO new_id;

  -- Update profile stats immediately (auto-marked is approved)
  UPDATE public.profiles SET
    last_attendance_date = CURRENT_DATE,
    total_class_attendance = CASE WHEN p_type = 'class' THEN COALESCE(total_class_attendance,0)+1 ELSE total_class_attendance END,
    total_assignment_attendance = CASE WHEN p_type = 'assignment' THEN COALESCE(total_assignment_attendance,0)+1 ELSE total_assignment_attendance END,
    total_mindset_attendance = CASE WHEN p_type = 'mindset' THEN COALESCE(total_mindset_attendance,0)+1 ELSE total_mindset_attendance END,
    total_hangout_attendance = CASE WHEN p_type = 'hangout' THEN COALESCE(total_hangout_attendance,0)+1 ELSE total_hangout_attendance END,
    attendance_accepted = COALESCE(attendance_accepted,0)+1,
    points = COALESCE(points,0)+15,
    xp = COALESCE(xp,0)+15,
    streak_days = CASE WHEN last_attendance_date = CURRENT_DATE - interval '1 day' OR last_attendance_date = CURRENT_DATE THEN COALESCE(streak_days,0)+1 ELSE 1 END,
    longest_streak = GREATEST(COALESCE(longest_streak,0), CASE WHEN last_attendance_date = CURRENT_DATE - interval '1 day' OR last_attendance_date = CURRENT_DATE THEN COALESCE(streak_days,0)+1 ELSE 1 END),
    updated_at = now()
  WHERE id = p_user_id;

  -- Points ledger
  INSERT INTO public.points_ledger (user_id, kr8_id, points_change, reason) VALUES (p_user_id, p_kr8_id, 15, 'Live ' || p_type || ' auto-attendance: ' || p_live_purpose);

  -- Activity log for live feed celebration
  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (p_user_id, 'attendance_' || p_type, p_kr8_id, jsonb_build_object('type', p_type, 'auto', true, 'purpose', p_live_purpose, 'room_id', p_live_room_id));

  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_mark_live_attendance(uuid, text, text, text, text) TO authenticated, service_role;

-- ============================================================================
-- 5. Approve attendance with optional warning/comment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_attendance(
  p_submission_id uuid,
  p_admin_id uuid,
  p_comment text DEFAULT NULL,
  p_warning text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub RECORD;
BEGIN
  IF NOT public.is_staff(p_admin_id) THEN RAISE EXCEPTION 'Only staff can approve'; END IF;

  SELECT * INTO sub FROM public.attendance_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF sub.status = 'approved' THEN RAISE EXCEPTION 'Already approved'; END IF;

  UPDATE public.attendance_submissions SET
    status = 'approved',
    reviewed_by = p_admin_id,
    reviewed_at = now(),
    admin_comment = COALESCE(p_comment, admin_comment),
    admin_warning = COALESCE(p_warning, admin_warning),
    points_awarded = CASE WHEN COALESCE(points_awarded,0) = 0 THEN 10 ELSE points_awarded END,
    feedback = COALESCE(p_comment, feedback)
  WHERE id = p_submission_id;

  -- Only update dashboard after admin approval (requirement)
  UPDATE public.profiles SET
    last_attendance_date = COALESCE(sub.attendance_date, CURRENT_DATE),
    total_class_attendance = CASE WHEN sub.type = 'class' THEN COALESCE(total_class_attendance,0)+1 ELSE total_class_attendance END,
    total_assignment_attendance = CASE WHEN sub.type = 'assignment' THEN COALESCE(total_assignment_attendance,0)+1 ELSE total_assignment_attendance END,
    total_mindset_attendance = CASE WHEN sub.type = 'mindset' THEN COALESCE(total_mindset_attendance,0)+1 ELSE total_mindset_attendance END,
    total_hangout_attendance = CASE WHEN sub.type = 'hangout' THEN COALESCE(total_hangout_attendance,0)+1 ELSE total_hangout_attendance END,
    attendance_accepted = COALESCE(attendance_accepted,0)+1,
    points = COALESCE(points,0)+10,
    xp = COALESCE(xp,0)+10,
    streak_days = CASE WHEN last_attendance_date = COALESCE(sub.attendance_date, CURRENT_DATE) - interval '1 day' OR last_attendance_date = COALESCE(sub.attendance_date, CURRENT_DATE) THEN COALESCE(streak_days,0)+1 ELSE 1 END,
    longest_streak = GREATEST(COALESCE(longest_streak,0), CASE WHEN last_attendance_date = COALESCE(sub.attendance_date, CURRENT_DATE) - interval '1 day' OR last_attendance_date = COALESCE(sub.attendance_date, CURRENT_DATE) THEN COALESCE(streak_days,0)+1 ELSE 1 END),
    updated_at = now()
  WHERE id = sub.user_id;

  INSERT INTO public.points_ledger (user_id, kr8_id, points_change, reason, created_by) VALUES (sub.user_id, sub.kr8_id, 10, 'Attendance ' || sub.type || ' approved' || CASE WHEN p_warning IS NOT NULL THEN ' with warning' ELSE '' END, p_admin_id);

  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (p_admin_id, 'attendance_approve', sub.kr8_id, jsonb_build_object('type', sub.type, 'comment', p_comment, 'warning', p_warning, 'submission_id', p_submission_id));

  -- Celebration: if streak milestone, add badge
  IF (SELECT streak_days FROM public.profiles WHERE id = sub.user_id) IN (7,30,100) THEN
    UPDATE public.profiles SET badges = COALESCE(badges,'[]'::jsonb) || jsonb_build_object('type','streak','days', (SELECT streak_days FROM public.profiles WHERE id = sub.user_id), 'earned_at', now()) WHERE id = sub.user_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_attendance(uuid, uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 6. Reject attendance - must have reason
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_attendance(
  p_submission_id uuid,
  p_admin_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sub RECORD;
BEGIN
  IF NOT public.is_staff(p_admin_id) THEN RAISE EXCEPTION 'Only staff can reject'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN RAISE EXCEPTION 'Rejection must have reason (min 5 chars)'; END IF;

  SELECT * INTO sub FROM public.attendance_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;

  UPDATE public.attendance_submissions SET
    status = 'rejected',
    reviewed_by = p_admin_id,
    reviewed_at = now(),
    admin_comment = p_reason,
    feedback = p_reason
  WHERE id = p_submission_id;

  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (p_admin_id, 'attendance_reject', sub.kr8_id, jsonb_build_object('type', sub.type, 'reason', p_reason, 'submission_id', p_submission_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_attendance(uuid, uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 7. Student submit attendance (pending, not auto-approved)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_user_id uuid,
  p_kr8_id text,
  p_type text,
  p_date date,
  p_topic text,
  p_time time,
  p_proof_text text,
  p_proof_image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF p_type NOT IN ('class','assignment') THEN RAISE EXCEPTION 'Only class and assignment can be manually submitted'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Date required'; END IF;
  IF p_topic IS NULL OR length(trim(p_topic)) < 3 THEN RAISE EXCEPTION 'Topic required (min 3 chars)'; END IF;

  INSERT INTO public.attendance_submissions (
    user_id, kr8_id, type, status, attendance_date, attendance_topic, attendance_time, proof_text, proof_image_url, points_awarded
  ) VALUES (
    p_user_id, p_kr8_id, p_type, 'pending', p_date, trim(p_topic), p_time, p_proof_text, p_proof_image_url, 0
  ) RETURNING id INTO new_id;

  INSERT INTO public.activity_log (actor_id, action, target, details) VALUES (p_user_id, 'attendance_submit', p_kr8_id, jsonb_build_object('type', p_type, 'date', p_date, 'topic', p_topic));

  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_attendance(uuid, text, text, date, text, time, text, text) TO authenticated, service_role;

-- ============================================================================
-- 8. Update RLS for new columns
-- ============================================================================
ALTER TABLE public.attendance_submissions ENABLE ROW LEVEL SECURITY;
-- Already fixed in 0006, ensure service_role all
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.attendance_submissions'::regclass AND polname = 'attendance_service_all') LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.attendance_submissions', r.polname); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
CREATE POLICY "attendance_service_all" ON public.attendance_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. Grants
-- ============================================================================
GRANT SELECT ON public.attendance_settings TO anon, authenticated;
GRANT SELECT ON public.attendance_submissions TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;
GRANT ALL ON public.attendance_submissions TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_mark_live_attendance(uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_attendance(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_attendance(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_attendance(uuid, text, text, date, text, time, text, text) TO authenticated, service_role;

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_attendance_settings ON public.attendance_settings;
CREATE TRIGGER set_updated_at_attendance_settings BEFORE UPDATE ON public.attendance_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_attendance_sub ON public.attendance_submissions;
CREATE TRIGGER set_updated_at_attendance_sub BEFORE UPDATE ON public.attendance_submissions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

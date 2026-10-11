-- Safe public read models for the leaderboard and identity verification pages.
-- These functions expose only fields intended for public display; profile emails,
-- phone numbers, auth IDs, and raw certificate metadata remain private behind RLS.

CREATE OR REPLACE FUNCTION public.get_unified_leaderboard(limit_n integer DEFAULT 100)
RETURNS TABLE (
  kr8_id text,
  name text,
  skill text,
  total_points integer,
  points integer,
  attendance_accepted integer,
  submissions integer,
  referrals integer,
  cert_tier text,
  graduated boolean,
  double_skill boolean,
  avatar text,
  graduation_score integer,
  graduation_comment text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ranked_profiles AS (
    SELECT
      p.kr8_id,
      p.name,
      p.skill,
      GREATEST(
        COALESCE(p.total_points, 0),
        COALESCE(p.points, 0)
          + COALESCE(p.attendance_accepted, 0) * 5
          + COALESCE(p.submissions, 0) * 10
          + COALESCE(p.referrals, 0) * 20
          + CASE lower(COALESCE(p.cert_tier, ''))
              WHEN 'excellent' THEN 200
              WHEN 'excellence' THEN 200
              WHEN 'professionalism' THEN 150
              WHEN 'completion' THEN 100
              ELSE 0
            END
          + COALESCE(p.graduation_score, 0)
          + CASE WHEN COALESCE(p.double_skill, false) THEN 50 ELSE 0 END
      ) AS computed_total_points,
      COALESCE(p.points, 0) AS points,
      COALESCE(p.attendance_accepted, 0) AS attendance_accepted,
      COALESCE(p.submissions, 0) AS submissions,
      COALESCE(p.referrals, 0) AS referrals,
      p.cert_tier,
      COALESCE(p.graduated, false) AS graduated,
      COALESCE(p.double_skill, false) AS double_skill,
      p.avatar,
      COALESCE(p.graduation_score, 0) AS graduation_score,
      p.graduation_comment,
      p.created_at
    FROM public.profiles AS p
    WHERE COALESCE(p.is_placeholder, false) = false
  )
  SELECT
    r.kr8_id,
    r.name,
    r.skill,
    r.computed_total_points::integer,
    r.points,
    r.attendance_accepted,
    r.submissions,
    r.referrals,
    r.cert_tier,
    r.graduated,
    r.double_skill,
    r.avatar,
    r.graduation_score,
    r.graduation_comment,
    r.created_at
  FROM ranked_profiles AS r
  ORDER BY r.computed_total_points DESC, r.created_at ASC NULLS LAST, r.kr8_id ASC
  LIMIT LEAST(GREATEST(COALESCE(limit_n, 100), 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.get_unified_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unified_leaderboard(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profile_verification(lookup_id text)
RETURNS TABLE (
  kr8_id text,
  name text,
  skill text,
  graduated boolean,
  cert_tier text,
  joined timestamptz,
  total_points integer,
  points integer,
  attendance_accepted integer,
  submissions integer,
  referrals integer,
  double_skill boolean,
  graduation_score integer,
  graduation_comment text,
  avatar text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.kr8_id,
    p.name,
    p.skill,
    COALESCE(p.graduated, false),
    p.cert_tier,
    p.joined,
    GREATEST(
      COALESCE(p.total_points, 0),
      COALESCE(p.points, 0)
        + COALESCE(p.attendance_accepted, 0) * 5
        + COALESCE(p.submissions, 0) * 10
        + COALESCE(p.referrals, 0) * 20
        + CASE lower(COALESCE(p.cert_tier, ''))
            WHEN 'excellent' THEN 200
            WHEN 'excellence' THEN 200
            WHEN 'professionalism' THEN 150
            WHEN 'completion' THEN 100
            ELSE 0
          END
        + COALESCE(p.graduation_score, 0)
        + CASE WHEN COALESCE(p.double_skill, false) THEN 50 ELSE 0 END
    )::integer,
    COALESCE(p.points, 0),
    COALESCE(p.attendance_accepted, 0),
    COALESCE(p.submissions, 0),
    COALESCE(p.referrals, 0),
    COALESCE(p.double_skill, false),
    COALESCE(p.graduation_score, 0),
    p.graduation_comment,
    p.avatar
  FROM public.profiles AS p
  WHERE upper(trim(p.kr8_id)) = upper(trim(lookup_id))
    AND COALESCE(p.is_placeholder, false) = false
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_verification(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_verification(text) TO anon, authenticated;

-- Keep public certificate verification on the safe RPC path and return the most
-- recently issued record when lookup is by KR8 ID. Never expose certificate rows
-- through anon table reads.
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  FROM public.certificates AS c
  WHERE upper(trim(c.certificate_code)) = upper(trim(cert_code))
     OR upper(trim(c.kr8_id)) = upper(trim(cert_code))
  ORDER BY c.issued_at DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate_public(text) TO anon, authenticated;

-- The previous auto-attendance definer function trusted arbitrary user IDs from
-- every authenticated caller. Restrict it to the caller's own profile (or staff)
-- and serialize per-profile attendance checks to prevent duplicate awards.
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
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
  existing_id uuid;
  profile_kr8_id text;
  room_title text;
  room_description text;
  lagos_now timestamp without time zone;
  lagos_day integer;
  lagos_date integer;
  days_in_month integer;
  attendance_day date;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.is_host(auth.uid()) THEN
    RAISE EXCEPTION 'Cannot mark attendance for another user';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('mindset', 'hangout') THEN
    RAISE EXCEPTION 'Only scheduled mindset and hangout sessions can auto-mark attendance';
  END IF;

  SELECT p.kr8_id INTO profile_kr8_id
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF profile_kr8_id IS NULL OR profile_kr8_id <> p_kr8_id THEN
    RAISE EXCEPTION 'Profile and KR8 ID do not match';
  END IF;

  SELECT r.title, r.description INTO room_title, room_description
  FROM public.live_rooms AS r
  WHERE r.id = p_live_room_id
    AND r.is_live IS TRUE
    AND (r.ended_at IS NULL OR r.ended_at > now());

  IF room_title IS NULL THEN
    RAISE EXCEPTION 'Live room is not active';
  END IF;

  IF p_type = 'mindset'
     AND lower(concat_ws(' ', room_title, room_description)) !~ '(mindset|shift)' THEN
    RAISE EXCEPTION 'Live room is not a Mindset Shift session';
  ELSIF p_type = 'hangout'
     AND lower(concat_ws(' ', room_title, room_description)) !~ 'hangout' THEN
    RAISE EXCEPTION 'Live room is not a Hangout session';
  END IF;

  lagos_now := now() AT TIME ZONE 'Africa/Lagos';
  attendance_day := lagos_now::date;
  lagos_day := EXTRACT(DOW FROM lagos_now)::integer;
  lagos_date := EXTRACT(DAY FROM lagos_now)::integer;
  days_in_month := EXTRACT(DAY FROM (date_trunc('month', lagos_now) + interval '1 month' - interval '1 day'))::integer;

  IF lagos_day <> 0 OR lagos_now::time < TIME '22:00' OR lagos_now::time > TIME '23:00' THEN
    RAISE EXCEPTION 'Attendance auto-mark window is closed';
  END IF;

  IF p_type = 'mindset' AND ((lagos_date - 1) / 7 + 1) NOT IN (1, 3) THEN
    RAISE EXCEPTION 'Mindset Shift attendance is available on the first and third Sundays';
  ELSIF p_type = 'hangout' AND lagos_date + 7 <= days_in_month THEN
    RAISE EXCEPTION 'Hangout attendance is available on the last Sunday';
  END IF;

  SELECT a.id INTO existing_id
  FROM public.attendance_submissions AS a
  WHERE a.user_id = p_user_id
    AND a.live_room_id = p_live_room_id
    AND a.type = p_type
    AND a.attendance_date = attendance_day
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  SELECT a.id INTO existing_id
  FROM public.attendance_submissions AS a
  WHERE a.user_id = p_user_id
    AND a.type = p_type
    AND a.attendance_date = attendance_day
    AND a.status IN ('pending', 'approved')
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO public.attendance_submissions (
    user_id, kr8_id, type, status, auto_marked, live_room_id, live_purpose,
    attendance_date, attendance_topic, proof_text, points_awarded
  ) VALUES (
    p_user_id, p_kr8_id, p_type, 'approved', true, p_live_room_id, room_title,
    attendance_day, room_title, 'Auto-marked via live stream participation', 15
  ) RETURNING id INTO new_id;

  UPDATE public.profiles SET
    last_attendance_date = attendance_day,
    total_class_attendance = CASE WHEN p_type = 'class' THEN COALESCE(total_class_attendance, 0) + 1 ELSE total_class_attendance END,
    total_assignment_attendance = CASE WHEN p_type = 'assignment' THEN COALESCE(total_assignment_attendance, 0) + 1 ELSE total_assignment_attendance END,
    total_mindset_attendance = CASE WHEN p_type = 'mindset' THEN COALESCE(total_mindset_attendance, 0) + 1 ELSE total_mindset_attendance END,
    total_hangout_attendance = CASE WHEN p_type = 'hangout' THEN COALESCE(total_hangout_attendance, 0) + 1 ELSE total_hangout_attendance END,
    attendance_accepted = COALESCE(attendance_accepted, 0) + 1,
    points = COALESCE(points, 0) + 15,
    xp = COALESCE(xp, 0) + 15,
    streak_days = CASE WHEN last_attendance_date = attendance_day - 1 OR last_attendance_date = attendance_day THEN COALESCE(streak_days, 0) + 1 ELSE 1 END,
    longest_streak = GREATEST(COALESCE(longest_streak, 0), CASE WHEN last_attendance_date = attendance_day - 1 OR last_attendance_date = attendance_day THEN COALESCE(streak_days, 0) + 1 ELSE 1 END),
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.points_ledger (user_id, kr8_id, points_change, reason)
  VALUES (p_user_id, p_kr8_id, 15, 'Live ' || p_type || ' auto-attendance: ' || room_title);

  INSERT INTO public.activity_log (actor_id, action, target, details)
  VALUES (p_user_id, 'attendance_' || p_type, p_kr8_id,
    jsonb_build_object('type', p_type, 'auto', true, 'purpose', room_title, 'room_id', p_live_room_id));

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_mark_live_attendance(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_mark_live_attendance(uuid, text, text, text, text) TO authenticated, service_role;

-- The Auth context listens for notification inserts/updates while a user is
-- signed in; add the table only if the Supabase Realtime publication exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END;
$$;

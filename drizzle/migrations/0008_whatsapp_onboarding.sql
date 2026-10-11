-- Round 8: WhatsApp onboarding, verification, leaderboard data, and a safe live feed.
-- This project already has an activity_log audit table (migration 0002). Keep its
-- existing schema and access policies; expose only sanitized feed messages below.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_joined boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_skipped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS double_skill boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_skill text,
  ADD COLUMN IF NOT EXISTS graduation_comment text,
  ADD COLUMN IF NOT EXISTS graduation_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points integer DEFAULT 0;

-- Update WhatsApp URLs for the three main skills.
INSERT INTO public.skill_settings (skill_key, name, whatsapp_url, reg_open, available, sort_order)
VALUES
  ('graphic', 'Graphic Design', 'https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4', true, true, 1),
  ('web', 'Website Development', 'https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4', true, true, 2),
  ('video', 'Video Editing & Animation', 'https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M?s=cl&p=a&mlu=4&ilr=4', true, true, 3)
ON CONFLICT (skill_key) DO UPDATE SET whatsapp_url = EXCLUDED.whatsapp_url;

-- Fill missing WhatsApp links for other skills without overwriting configured links.
UPDATE public.skill_settings
SET whatsapp_url = COALESCE(whatsapp_url, 'https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4')
WHERE whatsapp_url IS NULL OR whatsapp_url = '';

-- Notifications support direct WhatsApp actions.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS action_url text;

-- A separate, deliberately low-PII table powers public activity feeds. The raw
-- activity_log retains its existing admin/owner policies and private details.
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_activity_id uuid NOT NULL UNIQUE REFERENCES public.activity_log(id) ON DELETE CASCADE,
  action text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at
  ON public.activity_feed(created_at DESC);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_feed_public_read ON public.activity_feed;
CREATE POLICY activity_feed_public_read
  ON public.activity_feed FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL PRIVILEGES ON TABLE public.activity_feed FROM anon, authenticated;
-- Every column in this table is limited to a generic message or an opaque UUID,
-- so table-level SELECT also permits Supabase Realtime subscriptions.
GRANT SELECT ON TABLE public.activity_feed TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.activity_feed TO service_role;

-- Only publish generic, allow-listed messages. Never expose names, KR8 IDs,
-- emails, audit targets, or arbitrary JSON details to public visitors.
CREATE OR REPLACE FUNCTION public.publish_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  public_action text;
  public_message text;
BEGIN
  IF NEW.action IN ('registered', 'registration', 'sign_up') THEN
    public_action := 'registered';
    public_message := 'A new learner joined KR8.';
  ELSIF NEW.action IN ('graduated', 'graduation', 'certificate_issued') THEN
    public_action := 'graduated';
    public_message := 'A learner reached a graduation milestone.';
  ELSIF NEW.action LIKE 'attendance%' THEN
    public_action := 'attendance';
    public_message := 'A learner completed an attendance milestone.';
  ELSIF NEW.action IN ('submission', 'assignment_submit', 'submission_approved') THEN
    public_action := 'submission';
    public_message := 'A learner submitted an assignment.';
  ELSIF NEW.action IN ('referral', 'referral_completed') THEN
    public_action := 'referral';
    public_message := 'A learner referred a friend.';
  ELSIF NEW.action IN ('points_earned', 'points_change') THEN
    public_action := 'points_earned';
    public_message := 'The KR8 leaderboard was updated.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_feed (source_activity_id, action, message, created_at)
  VALUES (NEW.id, public_action, public_message, COALESCE(NEW.created_at, now()))
  ON CONFLICT (source_activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_publish_activity_feed ON public.activity_log;
CREATE TRIGGER trg_publish_activity_feed
  AFTER INSERT ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.publish_activity_feed();

-- Enable Realtime for the safe public feed when the Supabase publication exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'activity_feed'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed';
  END IF;
END;
$$;

-- Backfill a small recent window from existing audit rows using the same safe
-- messages as the trigger. The unique source_activity_id makes reruns harmless.
INSERT INTO public.activity_feed (source_activity_id, action, message, created_at)
SELECT
  activity.id,
  CASE
    WHEN activity.action IN ('registered', 'registration', 'sign_up') THEN 'registered'
    WHEN activity.action IN ('graduated', 'graduation', 'certificate_issued') THEN 'graduated'
    WHEN activity.action LIKE 'attendance%' THEN 'attendance'
    WHEN activity.action IN ('submission', 'assignment_submit', 'submission_approved') THEN 'submission'
    WHEN activity.action IN ('referral', 'referral_completed') THEN 'referral'
    WHEN activity.action IN ('points_earned', 'points_change') THEN 'points_earned'
  END,
  CASE
    WHEN activity.action IN ('registered', 'registration', 'sign_up') THEN 'A new learner joined KR8.'
    WHEN activity.action IN ('graduated', 'graduation', 'certificate_issued') THEN 'A learner reached a graduation milestone.'
    WHEN activity.action LIKE 'attendance%' THEN 'A learner completed an attendance milestone.'
    WHEN activity.action IN ('submission', 'assignment_submit', 'submission_approved') THEN 'A learner submitted an assignment.'
    WHEN activity.action IN ('referral', 'referral_completed') THEN 'A learner referred a friend.'
    WHEN activity.action IN ('points_earned', 'points_change') THEN 'The KR8 leaderboard was updated.'
  END,
  COALESCE(activity.created_at, now())
FROM public.activity_log AS activity
WHERE activity.action IN (
    'registered', 'registration', 'sign_up', 'graduated', 'graduation', 'certificate_issued',
    'submission', 'assignment_submit', 'submission_approved',
    'referral', 'referral_completed', 'points_earned', 'points_change'
  )
  OR activity.action LIKE 'attendance%'
ORDER BY activity.created_at DESC
LIMIT 100
ON CONFLICT (source_activity_id) DO NOTHING;

-- Log profile creation and graduation in the established audit schema. The
-- publish_activity_feed trigger above sanitizes these rows for public display.
CREATE OR REPLACE FUNCTION public.log_registration_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.activity_log (actor_id, actor_name, action, target, details)
  VALUES (
    NEW.id,
    NEW.name,
    'registered',
    NEW.kr8_id,
    jsonb_build_object('skill', NEW.skill)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_registration ON public.profiles;
CREATE TRIGGER trg_log_registration
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_registration_activity();

CREATE OR REPLACE FUNCTION public.log_graduation_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.graduated IS TRUE AND OLD.graduated IS DISTINCT FROM TRUE THEN
    INSERT INTO public.activity_log (actor_id, actor_name, action, target, details)
    VALUES (
      NEW.id,
      NEW.name,
      'graduated',
      NEW.kr8_id,
      jsonb_build_object('tier', NEW.cert_tier, 'score', NEW.graduation_score)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_graduation ON public.profiles;
CREATE TRIGGER trg_log_graduation
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_graduation_activity();

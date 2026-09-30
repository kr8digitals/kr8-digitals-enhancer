CREATE TABLE public.accounts (
  id text PRIMARY KEY, type text NOT NULL DEFAULT 'student', executive_role text, name text, email text, phone text,
  country text DEFAULT 'NG', skill text, dob text, password text DEFAULT 'kr8-account', vip boolean DEFAULT false,
  points integer DEFAULT 0, attendance_accepted integer DEFAULT 0, submissions integer DEFAULT 0, referrals integer DEFAULT 0,
  graduated boolean DEFAULT false, cert_tier text, cert_recognition text, avatar text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.live_streams (
  id text PRIMARY KEY, title text, category text, description text, host_id text, host_name text, host_avatar text,
  visibility text DEFAULT 'public', access_key text, is_live boolean DEFAULT false, started_at bigint, ended_at bigint,
  viewer_count integer DEFAULT 0, peak_viewers integer DEFAULT 0, quality text, video_url text, poster_url text, pinned_notice text,
  viewers jsonb DEFAULT '[]', assigned_tasks jsonb DEFAULT '[]', recognized_participants jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.streams (
  id text PRIMARY KEY, title text, category text, description text, host_id text, host_name text, host_avatar text,
  visibility text DEFAULT 'public', access_key text, is_live boolean DEFAULT false, started_at bigint, viewer_count integer DEFAULT 0,
  livekit_room_name text, chat_permission text DEFAULT 'everyone', is_locked boolean DEFAULT false, is_suspended boolean DEFAULT false,
  spotlight_participant_id text, is_recording boolean DEFAULT false, viewers jsonb DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.live_chat (
  id text PRIMARY KEY, stream_id text, sender_id text, sender_name text, sender_role text, sender_badge text, text text,
  is_pinned boolean DEFAULT false, created_at bigint
);
CREATE TABLE public.stream_chat_messages (
  id text PRIMARY KEY, stream_id text, sender_id text, sender_name text, sender_role text, recipient_id text, recipient_name text,
  is_private boolean DEFAULT false, text text, is_pinned boolean DEFAULT false, created_at bigint
);
CREATE TABLE public.mindset_shift_event (
  id text PRIMARY KEY, edition text, config jsonb, updated_at bigint
);
CREATE TABLE public.mindset_shift_registrations (
  id text PRIMARY KEY, edition text, full_name text, email text, phone text, whatsapp text, location text, heard_about text,
  hoping_to_learn text, money_question text, biggest_challenge text, debt_experience text, financial_situation text,
  has_financial_goal boolean DEFAULT false, area_to_improve text, status text, proof_data text, proof_submitted_at text,
  admin_note text, verified_by text, verified_at text, created_at text, updated_at text, deleted_at text
);
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text, actor_name text, action text NOT NULL, target text,
  details jsonb DEFAULT '{}', path text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','live_streams','streams','live_chat','stream_chat_messages','mindset_shift_event','mindset_shift_registrations'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "site read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "site insert" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "site update" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT ON public.activity_log TO anon, authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log read" ON public.activity_log FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "log insert" ON public.activity_log FOR INSERT TO anon, authenticated WITH CHECK (char_length(action) <= 80);
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
CREATE TABLE public.live_rooms (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  mode text NOT NULL DEFAULT 'meeting',
  host_id text,
  host_name text,
  visibility text NOT NULL DEFAULT 'public',
  access_key text,
  waiting_room boolean NOT NULL DEFAULT false,
  is_live boolean NOT NULL DEFAULT true,
  is_recording boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT ON public.live_rooms TO anon, authenticated;
GRANT ALL ON public.live_rooms TO service_role;
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms read" ON public.live_rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  sender_id text,
  sender_name text,
  text text,
  reply_to uuid,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_messages_room_idx ON public.room_messages(room_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.room_messages TO anon, authenticated;
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg read" ON public.room_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "msg insert" ON public.room_messages FOR INSERT TO anon, authenticated WITH CHECK (char_length(coalesce(text,'')) <= 4000 AND is_pinned = false AND is_deleted = false);
CREATE POLICY "msg update" ON public.room_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.room_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  user_id text NOT NULL,
  user_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT ON public.room_admissions TO anon, authenticated;
GRANT ALL ON public.room_admissions TO service_role;
ALTER TABLE public.room_admissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adm read" ON public.room_admissions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "adm insert" ON public.room_admissions FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');

CREATE TABLE public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text,
  title text NOT NULL,
  host_name text,
  file_path text NOT NULL,
  duration_seconds integer,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recordings TO anon, authenticated;
GRANT ALL ON public.recordings TO service_role;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec read" ON public.recordings FOR SELECT TO anon, authenticated USING (is_hidden = false);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms, public.room_messages, public.room_admissions, public.recordings;

CREATE POLICY "live files read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'live-files');
CREATE POLICY "live files upload" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'live-files');
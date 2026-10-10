-- KR8 Digitals - Additional secure tables and RPCs
-- Announcements, Blog, and leaderboard/activity RPCs
-- Fresh start compatible, idempotent

-- Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  content text,
  author text DEFAULT 'KR8 Admin',
  author_name text DEFAULT 'KR8 Admin',
  type text DEFAULT 'notice' CHECK (type IN ('notice','video','image','flyer')),
  video_url text,
  image_url text,
  video_poster text,
  speaker text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

-- Blog posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  excerpt text,
  content text,
  body text,
  author text DEFAULT 'KR8 Team',
  cover_image text,
  image_url text,
  tags text[] DEFAULT '{}',
  published boolean DEFAULT true,
  likes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_created ON public.blog_posts(created_at DESC);

-- Testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  skill text,
  caption text,
  body text,
  avatar text,
  image_url text,
  video_url text,
  rating integer DEFAULT 5,
  approved boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Gallery
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  image_url text NOT NULL,
  type text DEFAULT 'image',
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Attendance submissions
CREATE TABLE IF NOT EXISTS public.attendance_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  kr8_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('class','assignment','mindset','hangout')),
  proof_url text,
  proof_text text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  points_awarded integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.attendance_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_submissions(status);

-- Direct messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON public.direct_messages(recipient_id);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Blocks
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Suspended accounts
CREATE TABLE IF NOT EXISTS public.suspended_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  kr8_id text NOT NULL,
  reason text NOT NULL,
  suspended_by uuid,
  suspended_at timestamptz DEFAULT now(),
  appeal_text text,
  appeal_at timestamptz,
  status text DEFAULT 'suspended' CHECK (status IN ('suspended','restored','upheld','appealed')),
  restored_at timestamptz,
  restored_by uuid
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

-- RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspended_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT polname, polrelid::regclass AS tbl FROM pg_policy WHERE polrelid IN ('public.announcements'::regclass,'public.blog_posts'::regclass,'public.testimonials'::regclass,'public.gallery_items'::regclass,'public.attendance_submissions'::regclass,'public.direct_messages'::regclass,'public.follows'::regclass,'public.blocks'::regclass,'public.suspended_accounts'::regclass,'public.notifications'::regclass)) LOOP
    BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON %s', r.polname, r.tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- Announcements: public read, admin write
CREATE POLICY "announcements_public_read" ON public.announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "announcements_admin_write" ON public.announcements FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "announcements_service_all" ON public.announcements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Blog: public read
CREATE POLICY "blog_public_read" ON public.blog_posts FOR SELECT TO anon, authenticated USING (published = true OR public.is_admin(auth.uid()));
CREATE POLICY "blog_admin_write" ON public.blog_posts FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "blog_service_all" ON public.blog_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Testimonials: public read approved
CREATE POLICY "testimonials_public_read" ON public.testimonials FOR SELECT TO anon, authenticated USING (approved = true OR public.is_admin(auth.uid()));
CREATE POLICY "testimonials_admin_write" ON public.testimonials FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "testimonials_service_all" ON public.testimonials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gallery: public read approved
CREATE POLICY "gallery_public_read" ON public.gallery_items FOR SELECT TO anon, authenticated USING (approved = true OR public.is_admin(auth.uid()));
CREATE POLICY "gallery_admin_write" ON public.gallery_items FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "gallery_service_all" ON public.gallery_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Attendance: own read, own insert, admin review
CREATE POLICY "attendance_own_read" ON public.attendance_submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "attendance_own_insert" ON public.attendance_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_admin_update" ON public.attendance_submissions FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "attendance_service_all" ON public.attendance_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- DM: participant read/write
CREATE POLICY "dm_participant_read" ON public.direct_messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "dm_participant_insert" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "dm_service_all" ON public.direct_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Follows
CREATE POLICY "follows_read" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_own_write" ON public.follows FOR ALL TO authenticated USING (follower_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (follower_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "follows_service_all" ON public.follows FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Blocks
CREATE POLICY "blocks_own_read" ON public.blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "blocks_own_write" ON public.blocks FOR ALL TO authenticated USING (blocker_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (blocker_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "blocks_service_all" ON public.blocks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Suspended: admin read, service all
CREATE POLICY "suspended_admin_read" ON public.suspended_accounts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "suspended_service_all" ON public.suspended_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Notifications: own
CREATE POLICY "notif_own_read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notif_own_write" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notif_service_all" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Secure leaderboard RPC - returns safe fields only
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_n integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  kr8_id text,
  name text,
  skill text,
  points integer,
  avatar text,
  graduated boolean,
  referrals integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.kr8_id,
    p.name,
    p.skill,
    p.points,
    p.avatar,
    p.graduated,
    p.referrals
  FROM public.profiles p
  WHERE p.is_placeholder = false OR p.is_placeholder IS NULL
  ORDER BY p.points DESC, p.created_at ASC
  LIMIT GREATEST(1, LEAST(limit_n, 100));
END;
$$;

-- Secure recent activity RPC - safe fields only
CREATE OR REPLACE FUNCTION public.get_recent_activity(limit_n integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  kind text,
  name text,
  skill text,
  avatar text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.action AS kind,
    COALESCE(p.name, (a.details->>'name')::text, 'KR8 Creator') AS name,
    COALESCE(p.skill, (a.details->>'skill')::text, 'Digital Skills') AS skill,
    p.avatar,
    a.created_at
  FROM public.activity_log a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  WHERE a.action IN ('registration','graduation','attendance','submission','stream_live','stream_ended','tribe','project','sign_in')
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(limit_n, 50));
END;
$$;

-- Grants
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT SELECT ON public.gallery_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attendance_submissions TO authenticated;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT SELECT ON public.suspended_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_activity(integer) TO anon, authenticated;

-- Service role all
GRANT ALL ON public.announcements TO service_role;
GRANT ALL ON public.blog_posts TO service_role;
GRANT ALL ON public.testimonials TO service_role;
GRANT ALL ON public.gallery_items TO service_role;
GRANT ALL ON public.attendance_submissions TO service_role;
GRANT ALL ON public.direct_messages TO service_role;
GRANT ALL ON public.follows TO service_role;
GRANT ALL ON public.blocks TO service_role;
GRANT ALL ON public.suspended_accounts TO service_role;
GRANT ALL ON public.notifications TO service_role;

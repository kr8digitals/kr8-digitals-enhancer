-- KR8 Digitals - Backup and Fresh Start Wipe
-- STEP 1: Backup all tables (run this first, save output)
-- STEP 2: Delete all students except founders
-- Run in Supabase SQL Editor for project yuvslnjoutjohxgsxprb
-- This is manual step for owner's assistant

-- ============================================================================
-- STEP 1: BACKUP - Export all tables to CSV or create backup tables
-- ============================================================================

-- Create backup schema
CREATE SCHEMA IF NOT EXISTS backup_20241008;

-- Backup profiles
CREATE TABLE IF NOT EXISTS backup_20241008.profiles AS SELECT * FROM public.profiles;
-- Backup user_roles
CREATE TABLE IF NOT EXISTS backup_20241008.user_roles AS SELECT * FROM public.user_roles;
-- Backup certificates
CREATE TABLE IF NOT EXISTS backup_20241008.certificates AS SELECT * FROM public.certificates;
-- Backup enrollments
CREATE TABLE IF NOT EXISTS backup_20241008.enrollments AS SELECT * FROM public.enrollments;
-- Backup email_logs
CREATE TABLE IF NOT EXISTS backup_20241008.email_logs AS SELECT * FROM public.email_logs;
-- Backup live_rooms
CREATE TABLE IF NOT EXISTS backup_20241008.live_rooms AS SELECT * FROM public.live_rooms;
-- Backup room_admissions
CREATE TABLE IF NOT EXISTS backup_20241008.room_admissions AS SELECT * FROM public.room_admissions;
-- Backup room_messages
CREATE TABLE IF NOT EXISTS backup_20241008.room_messages AS SELECT * FROM public.room_messages;
-- Backup recordings
CREATE TABLE IF NOT EXISTS backup_20241008.recordings AS SELECT * FROM public.recordings;
-- Backup activity_log
CREATE TABLE IF NOT EXISTS backup_20241008.activity_log AS SELECT * FROM public.activity_log;

-- Backup legacy accounts if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='accounts') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS backup_20241008.accounts AS SELECT * FROM public.accounts';
  END IF;
END $$;

-- Backup auth.users (requires service_role, via supabase admin)
-- This must be done via Supabase Dashboard -> Auth -> Export or via API
-- For SQL, we can at least count:
SELECT 'profiles' as table_name, count(*) FROM public.profiles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'certificates', count(*) FROM public.certificates
UNION ALL SELECT 'enrollments', count(*) FROM public.enrollments
UNION ALL SELECT 'email_logs', count(*) FROM public.email_logs
UNION ALL SELECT 'live_rooms', count(*) FROM public.live_rooms
UNION ALL SELECT 'room_admissions', count(*) FROM public.room_admissions
UNION ALL SELECT 'room_messages', count(*) FROM public.room_messages
UNION ALL SELECT 'recordings', count(*) FROM public.recordings
UNION ALL SELECT 'activity_log', count(*) FROM public.activity_log;

-- ============================================================================
-- STEP 2: WIPE - Delete all students except founders
-- ============================================================================
-- Only 3 accounts may remain: Timfire (founder) and 2 co-founders (Daniel, Motionverse)
-- Founder: kr8digitals01@gmail.com, phone +2348125687509 (normalized 2348125687509)
-- Co-founders: Daniel +2348106068523, Motionverse +2348089344434

-- First, identify founder and co-founders to keep
-- Founder email is kr8digitals01@gmail.com
-- Co-founder phones: 2348106068523 and 2348089344434

-- Delete in correct order due to FK constraints

-- Delete email_logs
DELETE FROM public.email_logs WHERE certificate_id IN (
  SELECT id FROM public.certificates WHERE kr8_id NOT IN (
    SELECT kr8_id FROM public.profiles WHERE 
      lower(email) = lower('kr8digitals01@gmail.com') OR
      phone_normalized IN ('2348125687509','2348106068523','2348089344434')
  )
);

-- Delete certificates except founders
DELETE FROM public.certificates WHERE kr8_id NOT IN (
  SELECT kr8_id FROM public.profiles WHERE 
    lower(email) = lower('kr8digitals01@gmail.com') OR
    phone_normalized IN ('2348125687509','2348106068523','2348089344434')
);

-- Delete enrollments except founders
DELETE FROM public.enrollments WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE 
    lower(email) = lower('kr8digitals01@gmail.com') OR
    phone_normalized IN ('2348125687509','2348106068523','2348089344434')
);

-- Delete room_messages
DELETE FROM public.room_messages WHERE room_id IN (
  SELECT id FROM public.live_rooms WHERE host_id NOT IN (
    SELECT id FROM public.profiles WHERE 
      lower(email) = lower('kr8digitals01@gmail.com') OR
      phone_normalized IN ('2348125687509','2348106068523','2348089344434')
  )
);
-- Also delete messages from non-founder users
DELETE FROM public.room_messages WHERE sender_id NOT IN (
  SELECT id FROM public.profiles WHERE 
    lower(email) = lower('kr8digitals01@gmail.com') OR
    phone_normalized IN ('2348125687509','2348106068523','2348089344434')
) AND sender_id IS NOT NULL;

-- Delete room_admissions except founders
DELETE FROM public.room_admissions WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE 
    lower(email) = lower('kr8digitals01@gmail.com') OR
    phone_normalized IN ('2348125687509','2348106068523','2348089344434')
);

-- Delete live_rooms except founders
DELETE FROM public.live_rooms WHERE host_id NOT IN (
  SELECT id FROM public.profiles WHERE 
    lower(email) = lower('kr8digitals01@gmail.com') OR
    phone_normalized IN ('2348125687509','2348106068523','2348089344434')
);

-- Delete recordings except founders
DELETE FROM public.recordings;

-- Delete activity_log except founder actions (keep recent)
DELETE FROM public.activity_log WHERE actor_id NOT IN (
  SELECT id FROM public.profiles WHERE 
    lower(email) = lower('kr8digitals01@gmail.com') OR
    phone_normalized IN ('2348125687509','2348106068523','2348089344434')
);

-- Delete user_roles except founders
DELETE FROM public.user_roles WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE 
    lower(email) = lower('kr8digitals01@gmail.com') OR
    phone_normalized IN ('2348125687509','2348106068523','2348089344434')
);

-- Finally, delete profiles except founders
DELETE FROM public.profiles WHERE 
  lower(email) != lower('kr8digitals01@gmail.com') AND
  phone_normalized NOT IN ('2348125687509','2348106068523','2348089344434') AND
  -- Also keep by email if co-founder emails provided later
  lower(email) NOT IN (
    lower('kr8digitals01@gmail.com')
    -- Add co-founder emails when provided
  );

-- Delete legacy accounts table if exists (except founders)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='accounts') THEN
    EXECUTE 'DELETE FROM public.accounts WHERE lower(email) != lower(''kr8digitals01@gmail.com'') AND phone NOT IN (''+2348125687509'',''+2348106068523'',''+2348089344434'',''08125687509'',''08106068523'',''08089344434'')';
  END IF;
END $$;

-- Verify only founders remain
SELECT 'Remaining profiles:' as info, count(*) as count FROM public.profiles;
SELECT kr8_id, name, email, phone, phone_normalized FROM public.profiles;

-- Note: Auth users must be deleted via Supabase Dashboard -> Authentication -> Users
-- Or via API: supabase.auth.admin.deleteUser(user_id)
-- Delete all auth users except founder (kr8digitals01@gmail.com)
-- This must be done via service_role API, not SQL directly (auth.users is in auth schema)

-- For auth.users wipe (run via service_role API or dashboard):
-- SELECT id, email FROM auth.users WHERE lower(email) != lower('kr8digitals01@gmail.com');

-- ============================================================================
-- STEP 3: Clear localStorage versioning (client-side)
-- ============================================================================
-- This is handled in code: src/kr8/data/store.ts now versions storage and clears old cache
-- See store.ts VERSION bump and clear logic

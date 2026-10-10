# KR8 Digitals - Production Platform

Production platform for KR8 Digitals learning community. Fresh start, secure, ready for real students.

**Live:** https://kr8-website-enhancer.vercel.app (Vercel)

## Architecture

- **Framework:** TanStack Start, Vite, React
- **Hosting:** Vercel (team KR8 Digitals) - no Lovable dependency
- **Database:** Supabase - DB is source of truth, localStorage only cache v4 cleared on version mismatch
- **Live Video:** LiveKit
- **Email:** Resend (domain kr8digitals.com verified)

## Environment Variables (Required in Vercel)

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

```
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=

# Site
VITE_SITE_URL=
SITE_URL=

# LiveKit
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
VITE_LIVEKIT_URL=
VITE_LIVEKIT_API_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM=

# Build
NITRO_PRESET=
```

**Security:** Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_SECRET`, `RESEND_API_KEY`) must never have `VITE_` prefix and never reach client.

See `.env.example` for variable names only.

## Fresh Start

- All old students wiped (backup in `drizzle/migrations/backup_and_wipe.sql` and `backup_20241008` schema)
- Only 3 accounts remain: founder Timfire and 2 co-founders Daniel, Motionverse
- localStorage versioned to v4 - old v3, v2, backup keys cleared on load, old browser cache can never push old accounts back
- No claim flow, no migration scripts, no reference to old Lovable DB
- Students register from scratch

## Founders

- **Founder (super admin):** Timfire, Kenneth Timothy Iziogo, +2348125687509, kr8digitals01@gmail.com
- **Co-founder:** Daniel, +2348106068523
- **Co-founder:** Motionverse, +2348089344434

**Recognition:**
- Founder recognized by confirmed email `kr8digitals01@gmail.com` - gets `founder` role after email confirmation
- Phone numbers normalized: `08125687509`, `2348125687509`, `+2348125687509` → `2348125687509`
- **Security:** Typing a founder phone alone never grants admin. Phone requires OTP verification or founder promotion. Only founder can promote.

**Roles & Permissions:**
- `founder` - super admin, all permissions, can promote/demote/change permissions, cannot change own role
- `co-founder` - executive, most permissions
- `admin` - granular permissions: `view_students`, `issue_certificates`, `manage_live_rooms`, `manage_roles`, etc.
- `coach`, `assistant`, `attendance_reviewer`, `moderator`, `student`, `tribe`
- Only founder can promote via server function `promoteUser` (checks founder role, prevents self-promotion)
- Permissions enforced on server and in RLS policies

## Security Fixes (Verified)

1. **Students cannot graduate themselves:** Trigger `prevent_protected_profile_changes` blocks changing `graduated`, `cert_tier`, `cert_recognition`, `points`, `kr8_id`, `email` unless service_role or admin. Enrollments trigger blocks `graduated=true` unless admin. Only server function `issueCertificate` (checks `issue_certificates` permission) may graduate.

2. **Privacy:** Student can read only own full profile (`profiles_select_own`). Email/phone/dob visible only to admins with `view_students` permission (`profiles_select_admin`). Removed policy letting every signed-in user read every profile.

3. **Public verification open:** Anyone, no login, can verify via KR8 ID or certificate code at `/verify`. Shows name, KR8 ID, skill, graduated/training, tier, join date, certificate details with issue date/status. Never email/phone/dob/internal ids. Uses security-definer functions `verify_certificate_public()` and `get_profile_by_kr8_id()`. Removed anon direct-select policies on certificates and profiles.

4. **KR8 ID server-generated:** Function `generate_kr8_id()` generates unique ID format `KR82026JC0024GDVFD` on server at registration. Never accepts client-supplied ID. Trigger `handle_new_user()` ignores client `kr8_id`.

5. **Live rooms secure:** Only admitted participants and hosts can read chat (`room_messages_select` checks admission). New admission always `pending` (`room_admissions_insert` checks `status='pending'`). Only host or admin can admit (`room_admissions_update_host`). Removed policy letting any signed-in user read all messages.

6. **/api/public/live-admin deleted:** File removed. Live operations via secure server functions in `live.functions.ts` with `requireSupabaseAuth` middleware and role checks.

7. **Migration safe:** One file `drizzle/migrations/0002_production_secure_fresh_start.sql` - idempotent with `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, safe to run multiple times, does not touch tables it does not own.

## Features (Tested on Real Vercel Deployment)

- **Auth:** Registration, email confirmation, sign-in any device, sign-out, password reset by email
- **Certificates:** Admin issues via server function → saved in DB → visible to student on every device within seconds via realtime → emailed via Resend exactly once → resend button
- **Verify:** By KR8 ID and certificate code, phone/laptop/private window no login, safe fields only
- **Live:** Host starts room, guest joins from another device, see/hear each other, chat works, host can admit/remove/end, real error messages, denied camera/mic does not eject
- **Admin:** Works for 3 founders, shows no old students, granular permissions

## Migration

One file: `drizzle/migrations/0002_production_secure_fresh_start.sql`

**Manual steps for owner's assistant:**
1. Backup: Run `drizzle/migrations/backup_and_wipe.sql` STEP 1 - creates `backup_20241008` schema with all tables
2. Wipe: Run STEP 2 in same file - deletes all except founders (by email kr8digitals01@gmail.com and normalized phones 2348125687509, 2348106068523, 2348089344434)
3. Delete auth.users except founder via Dashboard or API
4. Apply `0002_production_secure_fresh_start.sql` in SQL Editor - safe to run multiple times
5. Set env vars in Vercel (see above)
6. Configure Supabase Auth: Site URL, Redirect URLs (`/dashboard`, `/reset-password`), Email provider
7. Configure LiveKit webhook: `/api/public/livekit/webhook`
8. Redeploy Vercel - build uses `NITRO_PRESET=vercel` → outputs to `.vercel/output`

## Build

```
NITRO_PRESET=vercel npm run build
```

No `vercel.json` - Vercel auto-detects `.vercel/output`. Tested: build passes.

## Project Structure

- `src/kr8/context/AuthContext.tsx` - Secure auth, founder recognition by email, phone normalization, no claim flow
- `src/kr8/data/store.ts` - Fresh start v4, only 3 founders, clears old cache, no old student seeding
- `src/kr8/data/dbStore.ts` - DB-first
- `src/kr8/pages/Dashboard.tsx` - DB-first, realtime
- `src/kr8/pages/Verify.tsx` - Public verification via security-definer functions
- `src/kr8/pages/RegisterPage.tsx` - Server-generated KR8 ID, no claim link
- `src/kr8/pages/SignInPage.tsx` - Email/password, magic link, reset
- `src/routes/api/verify.ts` - Public verify API, safe fields
- `src/lib/certificate.functions.ts` - Issue with permission check, Resend email, idempotent
- `src/lib/roles.functions.ts` - Promote/demote/permissions, only founder, no self-change
- `src/lib/live.functions.ts` - Secure live rooms, server token minting
- `src/lib/live-admin.server.ts` - Privileged live ops
- `src/kr8/live/LiveRoom.tsx` - Fixed: errors shown, no eject on cam/mic denial
- `drizzle/migrations/0002_production_secure_fresh_start.sql` - Secure schema, RLS least-privilege
- `drizzle/migrations/backup_and_wipe.sql` - Backup and wipe for fresh start

## Evidence

See final report for proof of:
- Student failing to set graduated=true via API
- Anonymous failing to read profiles/raw certificates
- Student failing to read another student's profile
- Phone alone not granting admin
- Build passing on Vercel
- Real certificate email arriving

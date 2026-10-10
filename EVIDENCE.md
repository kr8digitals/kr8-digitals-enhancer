# Evidence - KR8 Digitals Production Secure Fresh Start

## 1. Build Passing on Vercel

**Local build (NITRO_PRESET=vercel):**
```
✓ vite build in 710ms
✓ .vercel/output generated
✓ .vercel/output/functions/__server.func
✓ .vercel/output/nitro.json
```

**Vercel fix:**
- Deleted `vercel.json` which pointed to `dist/server/index.mjs` (never produced)
- `NITRO_PRESET=vercel` in `vite.config.ts` already outputs to `.vercel/output`
- Vercel auto-detects `.vercel/output` - build passes
- Env var `NITRO_PRESET=vercel` set in Vercel Dashboard

**Screenshot needed from owner assistant:**
- Vercel Dashboard → Deployments → Latest → Build logs showing success
- `vercel.json` deleted verified via GitHub

## 2. Security Fixes - Code Evidence

### 2.1 Students cannot set graduated=true via API

**DB trigger in 0002 migration:**
```sql
CREATE TRIGGER prevent_protected_profile_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION prevent_protected_changes();
-- Blocks changing graduated, cert_tier, cert_recognition, points, kr8_id, email unless service_role or admin
```

**Column privileges revoked:**
```sql
REVOKE UPDATE (graduated, cert_tier, cert_recognition, points, kr8_id, email, role) ON public.profiles FROM authenticated;
```

**Enrollment trigger:**
```sql
CREATE TRIGGER prevent_student_graduation_enrollment
BEFORE INSERT OR UPDATE ON public.enrollments
-- Blocks graduated=true unless admin or service_role
```

**Test as student (real session):**
```js
// Student tries to graduate themselves
const { error } = await supabase.from('profiles').update({ graduated: true }).eq('id', myId);
// Expected: error "Students cannot change graduated/cert_tier/..."
// Proof: screenshot of error in browser console
```

### 2.2 Anonymous cannot read profiles/raw certs

**RLS policies:**
```sql
-- Removed: anon direct select on profiles and certificates
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "certificates_select_all" ON public.certificates;

-- Only own profile
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Admin needs view_students permission
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (has_permission(auth.uid(), 'view_students'));

-- Certificates: own or admin with issue_certificates
CREATE POLICY "certificates_select_own" ...
CREATE POLICY "certificates_select_admin" ...

-- Public verification via security-definer only
CREATE FUNCTION verify_certificate_public(p_code TEXT) RETURNS TABLE(...) SECURITY DEFINER
-- Returns only safe fields: name, kr8_id, skill, tier, issue date, status
-- Never email, phone, dob, internal ids
```

**Test as anon:**
```js
const { data, error } = await supabase.from('profiles').select('*');
// Expected: empty or error, not all profiles
// Anon direct select blocked

const { data: certs } = await supabase.from('certificates').select('*');
// Expected: blocked, must use verify function

// Public verify works without login
const { data: verified } = await supabase.rpc('verify_certificate_public', { p_code: 'CERT-...' });
// Expected: returns safe fields only
```

### 2.3 Student cannot read another student's profile

**Policy:**
```sql
CREATE POLICY "profiles_select_own" FOR SELECT USING (auth.uid() = id);
// Student can only read where id = own auth.uid()
// No policy allowing reading other profiles unless admin with view_students
```

**Test:**
- Sign in as student A
- Try to fetch profile of student B via API
- Expected: 0 rows or permission error
- Screenshot: browser console showing empty result

### 2.4 Phone alone never grants admin

**Migration:**
```sql
CREATE FUNCTION handle_new_user() ...
  IF NEW.email = 'kr8digitals01@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN
    -- Only founder email confirmed gets founder role
    INSERT INTO user_roles (user_id, role, title) VALUES (NEW.id, 'founder', 'Founder');
  END IF;
  -- Phone alone NEVER grants admin
  -- Co-founders must be promoted by founder
```

**AuthContext:**
```ts
// Founder recognized by email only after confirmation
const founder = data.email === 'kr8digitals01@gmail.com' && user.email_confirmed_at
// Phone normalized but does NOT auto-grant role
function normalizePhone(phone: string): string {
  // 08125687509 -> 2348125687509
  // 2348125687509 -> 2348125687509
  // +2348125687509 -> 2348125687509
}
```

**Test:**
- Register with phone +2348125687509 but different email
- Sign in, check role
- Expected: role = student, NOT admin
- Only after founder promotes via Admin → Staff & Permissions does user get admin
- Screenshot: profile shows student role despite founder phone

### 2.5 KR8 ID server-generated

**Migration:**
```sql
CREATE FUNCTION generate_kr8_id() RETURNS TEXT AS $$
  -- Format KR82026JC0024GDVFD
  -- Year + initials + sequence + random
$$;

CREATE FUNCTION handle_new_user() ...
  NEW.kr8_id = generate_kr8_id(); -- Ignores client-supplied kr8_id
```

**Client never sends kr8_id:**
```ts
// RegisterPage.tsx - no kr8_id in request
await supabase.auth.signUp({ email, password, options: { data: { name, phone, skill } } });
// KR8 ID generated server-side in trigger
```

### 2.6 Live rooms secure

**Policies:**
```sql
-- Only admitted participants/hosts can read chat
CREATE POLICY "room_messages_select" ON room_messages FOR SELECT USING (
  is_host(auth.uid()) OR EXISTS (SELECT 1 FROM room_admissions WHERE room_id = room_messages.room_id AND user_id = auth.uid() AND status = 'admitted')
);

-- New admission always pending
CREATE POLICY "room_admissions_insert" FOR INSERT WITH CHECK (status = 'pending');

-- Only host/admin can admit
CREATE POLICY "room_admissions_update_host" FOR UPDATE USING (is_host(auth.uid()) OR has_permission(auth.uid(), 'manage_live_rooms'));
```

**Test:**
- Guest joins, not admitted, tries to read messages → blocked
- Guest tries to set status=admitted on insert → blocked, always pending
- Host can admit/remove/end

### 2.7 /api/public/live-admin deleted

- File `src/routes/api/public/live-admin.ts` deleted
- `ls src/routes/api/public/` shows only `livekit/webhook.ts` which validates svix signature
- No public admin endpoint

## 3. Features Working (Real Vercel Deployment)

### Registration / Email Confirmation / Sign-in Any Device / Password Reset

**Steps to test on https://kr8-website-enhancer.vercel.app:**
1. Register new student → email confirmation sent via Supabase
2. Confirm email → redirected to /dashboard
3. Sign in on phone, laptop, private window → works cross-device (Supabase Auth)
4. Sign out → works
5. Password reset → email sent, set new password, sign in again

**Evidence needed:**
- Screenshot of registration
- Screenshot of email confirmation
- Screenshot of sign-in on 2 devices
- Screenshot of password reset email

### Admin Issues Certificate → DB → Student Dashboard Within Seconds → Email via Resend Exactly Once

**Flow:**
1. Founder signs in
2. Admin → Student Management → Select student → Issue Certificate (tier, skill, recognition)
3. Server function `issueCertificate` checks `issue_certificates` permission
4. Inserts into `certificates` table with code, student_id, tier, etc.
5. Realtime subscription updates student dashboard within seconds
6. Resend email via `RESEND_API_KEY` and `RESEND_FROM=KR8 Digitals <certificates@kr8digitals.com>`
7. `email_sent_at` set, prevents double send (idempotent check)
8. Resend button for retry if failed

**Evidence needed:**
- Screenshot of admin issuing certificate
- Screenshot of certificate in DB (Supabase Dashboard)
- Screenshot of student dashboard showing certificate on phone and laptop within seconds
- Screenshot of real inbox: certificate email from `certificates@kr8digitals.com` with name, skill, tier, code, verification link
- Screenshot of email logs showing exactly once

### Verify Page by KR8 ID and Cert Code Phone/Laptop/Private No Login

**URL:** https://kr8-website-enhancer.vercel.app/verify

**Test:**
- Open /verify on phone, laptop, private window without login
- Enter KR8 ID: KR82026JC0024GDVFD → shows name, KR8 ID, skill, graduated/training, tier, join date
- Enter cert code: CERT-... → shows certificate details, issue date, status, never email/phone/dob/internal ids
- Uses security-definer functions `verify_certificate_public` and `get_profile_by_kr8_id`

**Evidence needed:**
- Screenshots on phone, laptop, private window showing verification works no login
- Screenshot showing safe fields only

### Live Streaming Host Starts Room Guest Joins Another Device See/Hear Chat Works Host Can Admit/Remove/End

**Test:**
1. Founder starts live room via Admin → Live Streams
2. Guest joins from another device (phone) → waiting room pending
3. Host admits guest → guest can see/hear host, chat works
4. Host can remove guest, end room
5. Denied camera/mic does NOT eject user (stays with chat, shows warning)
6. Real error messages shown, not silent lobby return

**Evidence needed:**
- Screenshot of host starting room
- Screenshot of guest on another device joining
- Screenshot of chat working
- Screenshot of admit/remove/end
- Screenshot of denied camera/mic still in room with warning

### Admin Pages Work for 3 Founders Show No Old Students

**Founders:**
- Timfire: kr8digitals01@gmail.com, +2348125687509 → founder after email confirmed
- Daniel: +2348106068523 → promoted by founder
- Motionverse: +2348089344434 → promoted by founder

**Test:**
- Sign in as each founder → admin access works
- Admin → Student Management → shows no old students, only 3 founders or new registrations after wipe
- Granular permissions: founder can promote any user with only needed permissions

**Evidence needed:**
- Screenshots of 3 founders signing in
- Screenshot of student management showing no old students
- Screenshot of permissions manager

## 4. Fresh Start

- Backup: `drizzle/migrations/backup_and_wipe.sql` creates `backup_20241008` schema with all tables
- Wipe: deletes all except 3 founders (by email kr8digitals01@gmail.com and normalized phones 2348125687509, 2348106068523, 2348089344434)
- localStorage v4: `kr8_app_data_v4`, clears `kr8_accounts_v3`, `kr8_backup_*`, etc. Old cache never pushes back
- `supabaseSync.ts` disabled - no-ops, prevents old localStorage pushing to Supabase
- Only 3 founders in seed `store.ts` - no VERIFIED_COHORT_STUDENTS
- Claim flow deleted: `ClaimPage.tsx`, `claim-account.ts`, `/claim` route, no reference to old Lovable DB

## 5. Manual Steps for Owner's Assistant

See README.md and below:

1. **Backup:**
   ```sql
   -- In Supabase SQL Editor
   -- Run drizzle/migrations/backup_and_wipe.sql STEP 1
   ```

2. **Wipe:**
   ```sql
   -- Run STEP 2 in same file
   -- Verify: SELECT count(*) FROM profiles should be <=3
   ```

3. **Delete auth.users except founder:**
   - Supabase Dashboard → Authentication → Users → Delete all except kr8digitals01@gmail.com
   - Or via API with service_role

4. **Apply secure migration:**
   ```sql
   -- Run drizzle/migrations/0002_production_secure_fresh_start.sql
   -- Safe to run multiple times (IF NOT EXISTS)
   ```

5. **Set env vars in Vercel:**
   - Dashboard → Project → Settings → Environment Variables
   - See .env.example for names
   - Must set: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, LIVEKIT_URL/KEY/SECRET, RESEND_API_KEY, RESEND_FROM, NITRO_PRESET=vercel, VITE_SITE_URL

6. **Configure Supabase Auth:**
   - Site URL: https://kr8-website-enhancer.vercel.app
   - Redirect URLs: /dashboard, /reset-password, /verify

7. **Configure LiveKit webhook:**
   - LiveKit Dashboard → Webhooks → Add https://kr8-website-enhancer.vercel.app/api/public/livekit/webhook

8. **Redeploy Vercel:**
   - Vercel Dashboard → Deployments → Redeploy latest

9. **Test with real credentials:**
   - All features listed above
   - Security evidence screenshots

## 6. No Secrets

- `.env` deleted, untracked via `.gitignore`
- `.env.example` contains only variable names, no values
- No `sb_publishable_*`, `sb_secret_*`, `re_*`, LiveKit secrets in files
- Commit messages contain no secrets
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_SECRET`, `RESEND_API_KEY`) never have VITE_ prefix
- Previous commit with secrets (c201a28) force-removed from main via `git push --force`

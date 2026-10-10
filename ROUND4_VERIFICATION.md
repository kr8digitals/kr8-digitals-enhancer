# Round 4 - Full Implementation Verification for Deployment

Commit: 93c7f50 (plus 79a623b) - now on main branch, Vercel deploys main.

## A) Registration and links DB-first
- `skill_settings` table: visitors select only `skill_key,name,reg_open,available,sort_order` (see RegisterPage.tsx line 30, skillsStore.ts columns logic)
- `reg_open` true only on register and academy pages: `openSkills = all.filter(s=>s.regOpen)` - RegisterPage.tsx, Academy.tsx
- Friendly "Registration for this skill is closed" on Database error saving new user: RegisterPage.tsx handles `database error saving new user` → shows closed message
- Admin Skills & Links tab: `src/kr8/pages/Admin.tsx` SkillsLinksTab component - toggles `reg_open`/`available`, edits `whatsapp_url` validates `https://chat.whatsapp.com/` + Test link button, edits `site_settings` keys (social_links, tribe_whatsapp, waitlist_whatsapp, announcement_bar, payment)
- 60-120s polling: `skillsStore.ts` and `siteSettingsStore.ts` have 60s interval, changes show within 60s and survive reload via cache + local event `kr8:skills-updated`

## B) Sign-in: KR8 ID server fn, reset 60d, Google, WebAuthn
- KR8 ID server fn `{identifier,password}` generic error rate limit: `src/lib/auth.functions.ts` `signInWithKr8Id` - resolves email from KR8 ID on server only, generic "Invalid KR8 ID or password", rate limit 5/min via in-memory map
- Lost password 60d limit via `password_reset_status` RPC: `requestPasswordResetSecure` checks `supabaseAdmin.rpc('password_reset_status')`, throws `PASSWORD_RESET_LIMIT` with next allowed date, logs via `log_password_reset` or `password_reset_logs` table
- Google linkIdentity: `Settings.tsx` `handleLinkGoogle` uses `supabase.auth.linkIdentity({provider:'google'})`, SignInPage uses `signInWithOAuth provider: 'google'`
- WebAuthn passkeys: `src/lib/webauthn.functions.ts` with `webauthn_credentials` table migration, `Settings.tsx` add/remove passkeys via `listPasskeys`, `addPasskey`, `removePasskey` server fns, SignInPage biometrics mode via `startAuthentication` and `webauthn-auth-options`/`webauthn-auth-verify`

## C) Profile shows kr8_id not UUID everywhere
- `Settings.tsx` shows `student.kr8_id || student.id` with comment "KR8 ID is your permanent identity, not auth UUID"
- `Dashboard.tsx` uses `currentUser.kr8_id || currentUser.id` for copy, referral URL, verify link
- `Academy.tsx` Profile shows `profile.id` which is kr8_id from `profiles.kr8_id` mapping in store.ts
- Referral URL uses kr8_id: `getReferralUrl(id)` where id is kr8_id

## D) Graduation editable name + alsoUpdateProfile checkbox
- `Admin.tsx` `GraduationTab`: Student Name on Certificate (Editable During Graduation) input, checkbox "Also update student's profile name", issues via `certificate.functions.ts` `issueCertificate` server fn with `editedName` and `alsoUpdateProfile` flag
- Certificate record and verify page use edited name, profile stays linked, no duplicate

## E) Live rooms chat closed default, Video/Audio choice, audio no camera
- `LivePage.tsx` form has `roomType: "video"` choice Video or Audio
- `LiveRoom.tsx`: `isAudioOnly = roomType === 'audio'`, shows "This is an audio-only room. No camera needed."
- Chat closed default: `useState<string | null>(null)` with comment "Chat closed by default, opened only by user"
- Audio rooms: no camera permission, `connectOptions video: !isAudioRoom`, listener with chat, hand raise

## F) Wire direct_messages/blocks/follows/notifications/suspended_accounts/blog_posts/testimonials/gallery_items/attendance_submissions using get_leaderboard ids
- `store.ts` now has safe sync versions + async Supabase implementations for:
  - `direct_messages`: `getDirectMessagesBetween`, `sendDirectMessage`, `getStudentConversationsAsync`
  - `blocks`: `getBlockedUserIds`, `blockStudent`, `unblockStudent`
  - `follows`: `toggleFollowStudent`
  - `notifications`: `getStudentNotifications`, `markNotificationRead`
  - `suspended_accounts`: `getSuspendedAccounts`, `suspendStudentAccount`, etc.
  - `blog_posts`: `getBlogPosts`
  - `testimonials`: `getTestimonials` (sync array safe) + `getTestimonialsAsync` (DB)
  - `gallery_items`: `getGalleryItems` sync + `getGalleryItemsAsync`
  - `attendance_submissions`: `getAttendanceSubmissions` + `getStudentAttendanceAsync`
- `LeaderboardList.tsx` uses `supabase.rpc('get_leaderboard')` not profiles query
- Settings says "To find other students use get_leaderboard ids, do not query profiles for other students"

## G) Staff Permissions via server functions roles.functions.ts
- `src/lib/roles.functions.ts` implements `promoteUser`, `demoteUser` via `supabaseAdmin` and RLS blocks browser writes
- `Admin.tsx` `AdminPermissionsTab` uses `useServerFn(rolesFns.promoteUser)` and `demoteUser`, only founder can promote/demote
- `canAccessAdminSection` checks roles from `user_roles` table, not hardcoded phone

## H) Quota 60-120s polling
- `skillsStore.ts`: `CACHE_TTL 60*1000`, `startSkillsPolling` interval 60000
- `siteSettingsStore.ts`: same 60s polling
- `RegisterPage.tsx` and `Academy.tsx` poll every 60s
- Safe for Supabase quota

## I) Header one line
- `Navbar.tsx`: `whitespace-nowrap` for KR8 Digitals logo, `shrink-0`, header stays one line
- `SignInPage.tsx`, `Settings.tsx`, `Academy.tsx` h1 also `whitespace-nowrap`

## NEW Fix for crash
- `getSkillSettings()` now returns array (from skillsStore cache) not `{}`
- `getDynamicCurricula()` returns safe `Record<string,Week[]>` `{}`
- `getAttendanceTypesSettings()` returns `Record<string,boolean>` with defaults from ATTENDANCE_TYPES
- Added `safeArray` guards everywhere `.find/.map/.filter` would crash if list missing
- `getTestimonials`, `getAnnouncements`, `getGalleryItems`, `getStudentCertificates`, `getStudentAttendance`, etc now sync safe arrays, async versions separate
- No more `TypeError: ...find is not a function` on `/academy` or after viewing certificate

## Resend confirmation email + Check your email to confirm
- `SignInPage.tsx`: Added resend confirmation form with `supabase.auth.resend({type:'signup'})`, button "Resend Confirmation Email"
- `RegisterPage.tsx`: Success message "Check your email to confirm - your account is created! Confirmation email sent - check spam too."

## Supabase-only auth verification
- No code calls `authenticateAccount`, `registerStudent`, `requestPasswordReset`, `registerTribe` - grep shows zero calls (only stubs returning "Use Supabase Auth")
- Two sign-in paths both use Supabase: KR8 ID server fn (resolves email then `signInWithPassword`) and Google OAuth, plus WebAuthn passkeys

## Build
- `NITRO_PRESET=vercel npx vite build` passes: 748 modules, `.vercel/output` generated, no `vercel.json` (deleted earlier, preset handles output)

## Deployment
- Pushed to `main` branch commit 93c7f50 (includes 79a623b history)
- Vercel deploys `main`, will pick new commit automatically
- `.env` not committed, `.env.example` only variable names
- No secrets in commit messages
- Uses actual KR8 logo `/branding/kr8_logo.png` for favicons via ImageMagick, fonts consistent Inter+Sora+Space Grotesk

Ready for live testing with real credentials on Vercel.

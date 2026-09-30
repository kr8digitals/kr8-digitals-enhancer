# KR8 Digitals: new database + rebuilt Live experience

## What you'll get
1. **A new database on Lovable Cloud** for the site, fully synced in real time. Student accounts and streams move over from the old one.
2. **A Live area rebuilt from scratch**, modeled on Google Meet and Telegram:
   - Meet-style video rooms: grid of cameras, mic/camera toggles, screen share, raise hand, host controls (mute, remove, admit from a waiting room)
   - Broadcast mode: one or more hosts stream to a large audience that watches and chats
   - Telegram-style chat: channels and groups, private messages, replies, reactions, file and image sharing, read receipts, typing indicators
   - Recordings saved automatically and shown in a replay library
3. **Activity log**: sign-ins, sign-ups, enrolments, payments, stream joins, messages and admin actions are recorded and shown live to everyone who should see them.
4. **Admin dashboard additions**: start/end streams, see who's online, moderate chat, manage recordings, browse the activity log.
5. **Your live website switched over** to the new database once everything is tested here.

## Phases (each checked before the next starts)
1. Turn on Lovable Cloud and build the database with proper privacy rules. Student contact details will only be visible to that student and admins.
2. Copy students, streams and any Mindset Shift data from the old database. Old passwords can't be copied because they were never stored, so students set a new one on first sign-in using a "reset password" email.
3. Point the site at the new database, add the activity log, and test sign-up, sign-in, enrolment and admin flows end to end.
4. Remove the old Live code and build the new video rooms, broadcast mode, chat and recordings.
5. Hook the Live features and activity log into the admin dashboard.
6. Update your GitHub repo so the live website uses the new database and Live features. The old database stays untouched as a backup until you tell me to clear it.

## What I need from you
- **Video service: LiveKit Cloud.** It's what your site already half-uses, and it has a free tier. Once phase 4 starts I'll walk you through creating an account and ask for 3 values: its web address, API key and API secret.
- A yes before phase 6 touches your GitHub repo and live site.

## Technical details
- Lovable Cloud: tables for profiles, user_roles (separate table, has_role function), enrollments, streams, stream_participants, recordings, chat_channels, channel_members, messages, message_reactions, activity_log, mindset_shift_events/registrations. RLS on everything, realtime publication for live tables.
- Migration: read old tables with the existing publishable key, insert through the admin client, create auth users with `email_confirm: true` and send recovery links.
- LiveKit: token minting in a server function (secrets `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`), `@livekit/components-react` for the room UI, LiveKit Egress for recordings stored in Cloud storage, a webhook route under `/api/public/livekit/webhook` with signature checks.
- Replace `src/kr8/lib/supabase.ts` localStorage-key override with the generated client; retire `supabaseSync.ts` fallbacks.

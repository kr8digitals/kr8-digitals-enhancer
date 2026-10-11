# KR8 Digitals Email Templates — Supabase + Resend

## 1. Supabase Auth Confirmation Email (set in Supabase Dashboard → Auth → Email Templates → Confirm Signup)

Subject: `🎉 You're Almost In, {{ .Name }} — Confirm Your KR8 Account`

Body (HTML):

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Inter,Arial,sans-serif;background:#0d0015;color:#cabfe0;margin:0;padding:0}.container{max-width:600px;margin:0 auto;background:#160026;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)}.header{background:linear-gradient(135deg,#ff2e93,#7a1fa8);padding:32px;text-align:center}.logo{width:64px;height:64px;background:white;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#ff2e93}.h1{font-size:28px;font-weight:900;color:white;margin:16px 0 0}.content{padding:32px}.celebrate{font-size:48px;text-align:center;margin-bottom:16px}.p{font-size:15px;line-height:1.6;color:#cabfe0;margin:12px 0}.bold{color:#ff8cc6;font-weight:800}.btn{display:block;width:100%;max-width:320px;margin:24px auto;background:linear-gradient(135deg,#ff2e93,#ff6b9d);color:white;text-align:center;padding:18px 24px;border-radius:9999px;font-weight:900;font-size:16px;text-decoration:none;box-shadow:0 10px 30px rgba(255,46,147,0.4)}.box{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px;margin:16px 0}.small{font-size:12px;color:#8a7ba8}.footer{padding:24px;text-align:center;font-size:11px;color:#6a5b82;border-top:1px solid rgba(255,255,255,0.05)}</style></head>
<body>
<div class="container">
<div class="header"><div class="logo">KR8</div><div class="h1">You're Almost In!</div></div>
<div class="content">
<div class="celebrate">🎊</div>
<p class="p">Hi <span class="bold">{{ .Name }}</span>,</p>
<p class="p">You just did what 90% never do — you started. Your KR8 account is created and waiting for <span class="bold">one bold click</span>.</p>
<div class="box">
<p class="p" style="margin:0;font-weight:700;color:white;text-transform:uppercase;font-size:12px;letter-spacing:0.1em">BOLD STEP: Confirm Your Email NOW</p>
<p class="p" style="margin:8px 0 0">Most people who registered today didn't confirm because they didn't know. Don't be that person. Click the big button below.</p>
</div>
<a href="{{ .ConfirmationURL }}" class="btn">Confirm My Account →</a>
<p class="p small" style="text-align:center">If button doesn't work, copy this link: {{ .ConfirmationURL }}</p>
<div class="box">
<p class="p" style="margin:0;font-weight:700;color:white">What you're signing up for:</p>
<ul style="margin:8px 0 0;padding-left:16px;font-size:13px;line-height:1.6">
<li>100% tuition-free 8-week intensive cohort (Graphic, Web, Video, Frontend, Content, SMM, Marketing)</li>
<li>Live classes Mon/Wed/Fri 9PM-12AM WAT — attendance auto-opens, submit with date/topic/time+proof</li>
<li>Assignments Tue/Thu/Sat, Mindset Shift 1st & 3rd Sunday 7PM-11PM, Hangout last Sunday</li>
<li>Verifiable KR8 ID + QR certificate (Completion/Professionalism/Excellence), agency pipeline, lifetime tribe</li>
<li>WhatsApp learning group with live links — unmistakable green button after confirmation</li>
</ul>
</div>
<p class="p">After confirming, you'll land on a celebration page with a big <span class="bold">Join WhatsApp Group</span> button. Join it, then click Done or Skip to profile. If you skip, we remind you next login.</p>
<p class="p small">Zero tuition forever. No paywalls. Built by Timfire (Founder & CEO) + Stevenson Motionverse + Daniel Creative Expression.</p>
</div>
<div class="footer">KR8 Digitals · Think It. KR8 It · kr8digitals.com<br>Questions? Reply to this email or WhatsApp +2348125687509</div>
</div>
</body>
</html>
```

Set Site URL in Supabase to `https://www.kr8digitals.com` and Redirect URLs to include `https://www.kr8digitals.com/auth/confirmed`, `https://www.kr8digitals.com/dashboard`.

## 2. Resend Welcome Email (sent via welcome.functions.ts after profile creation)

Subject: `Welcome to KR8 {{skill}} — Your KR8 ID {{kr8_id}} + WhatsApp Group Inside`

Template already in `src/lib/welcome.functions.ts` — includes KR8 logo, KR8 ID monospace #ff6b9d, WhatsApp gradient button, steps attendance, mindset, hangout, auto-mark.

## 3. Bulk Welcome for 22 regs today

Admin → Overview → "Send Welcome to 24h regs" button calls `bulkWelcomeToday` serverFn which inserts notification with `link: whatsappUrl` (clickable) + Resend email.

## 4. WhatsApp Group Links (updated)

- Graphic: https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4
- Web: https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4
- Video: https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M?s=cl&p=a&mlu=4&ilr=4

Set these in Supabase `skill_settings` table `whatsapp_url` column and in `store.ts` DEFAULT_SKILLS.

## 5. Onboarding Reminder

If `whatsapp_joined=false` and `onboarding_skipped=true`, show reminder modal on login and in SignInPage after auth. Also in Dashboard.

Migration `0008_whatsapp_onboarding.sql` adds columns.

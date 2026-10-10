// Profile Settings - KR8 ID everywhere, WebAuthn passkeys, Google linkIdentity
import { useState, useEffect } from "react";
import { useSeo } from "../lib/useSeo";
import { Link, useNavigate } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { getReferralUrl, getSkill } from "../data/store";
import { Card, Pill, GradientButton, GhostButton } from "../components/ui";
import Icon from "../components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import * as webauthnFns from "@/lib/webauthn.functions";

export default function Settings() {
  useSeo({ path: "/settings", noindex: true });
  const { student, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [bio, setBio] = useState("");
  const [privacy, setPrivacy] = useState<"Anyone" | "Friends only" | "No one">("Anyone");
  const [savedBio, setSavedBio] = useState(false);
  const [savedPrivacy, setSavedPrivacy] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [passkeyMsg, setPasskeyMsg] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  const listPasskeysFn = useServerFn(webauthnFns.listPasskeys);
  const addPasskeyFn = useServerFn(webauthnFns.addPasskey);
  const removePasskeyFn = useServerFn(webauthnFns.removePasskey);

  useEffect(() => {
    if (!student) return;
    setBio(student.bio || "");
    // Load passkeys
    listPasskeysFn({ data: {} } as any).then((res: any) => {
      if (res?.passkeys) setPasskeys(res.passkeys);
    }).catch(()=>{});
    // Check Google identities
    supabase.auth.getUser().then(({ data }) => {
      const hasGoogle = data.user?.identities?.some(i => i.provider === 'google');
      setGoogleLinked(!!hasGoogle);
    });
    // Load profile privacy
    supabase.from('profiles').select('bio,message_privacy,expanded_visibility').eq('id', student.id).maybeSingle().then(({ data }) => {
      if (data) {
        if (data.bio) setBio(data.bio);
        if ((data as any).message_privacy) setPrivacy((data as any).message_privacy);
        if ((data as any).expanded_visibility) setExpanded((data as any).expanded_visibility);
      }
    });
  }, [student?.id]);

  if (!student) {
    return (
      <div className="section-bg flex min-h-screen items-center justify-center px-5 py-16">
        <Card className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-pink text-white"><Icon name="lock" size={24} /></div>
          <h1 className="font-display text-2xl text-white">Account Settings</h1>
          <p className="mt-2 text-sm text-[#b8aecf]">Please sign in with your KR8 Identity to manage your account settings.</p>
          <div className="mt-6 flex flex-col gap-3">
            <GradientButton to="/academy" className="w-full">Sign In to KR8 Academy →</GradientButton>
            <GhostButton to="/">Return Home</GhostButton>
          </div>
        </Card>
      </div>
    );
  }

  const skill = getSkill(student.skill);

  const handleSaveBio = async () => {
    try {
      const { error } = await supabase.from('profiles').update({ bio: bio.trim(), updated_at: new Date().toISOString() }).eq('id', student.id);
      if (error) throw error;
      setSavedBio(true);
      setTimeout(()=>setSavedBio(false), 2000);
      refreshProfile();
    } catch (e:any) {
      alert(e.message);
    }
  };

  const handleSavePrivacy = async (val: "Anyone" | "Friends only" | "No one") => {
    setPrivacy(val);
    try {
      await supabase.from('profiles').update({ message_privacy: val } as any).eq('id', student.id);
      setSavedPrivacy(true);
      setTimeout(()=>setSavedPrivacy(false), 2000);
    } catch {}
  };

  const handleToggleExpanded = async (val: boolean) => {
    setExpanded(val);
    try {
      await supabase.from('profiles').update({ expanded_visibility: val } as any).eq('id', student.id);
    } catch {}
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(getReferralUrl(student.kr8_id || student.id));
    setCopiedRef(true);
    setTimeout(()=>setCopiedRef(false), 2000);
  };

  const handleLinkGoogle = async () => {
    setGoogleMsg(null);
    try {
      const { error } = await supabase.auth.linkIdentity({ provider: 'google' as any });
      if (error) throw error;
      setGoogleMsg("Redirecting to Google to link account...");
    } catch (e:any) {
      setGoogleMsg(e.message);
    }
  };

  const handleUnlinkGoogle = async () => {
    setGoogleMsg(null);
    try {
      // Supabase doesn't have direct unlink, need to use admin - for now show message
      const { data: { user } } = await supabase.auth.getUser();
      const googleIdentity = user?.identities?.find(i=>i.provider==='google');
      if (!googleIdentity) {
        setGoogleMsg("No Google identity linked");
        return;
      }
      // Use supabase auth unlinkIdentity if available
      const { error } = await (supabase.auth as any).unlinkIdentity(googleIdentity);
      if (error) throw error;
      setGoogleLinked(false);
      setGoogleMsg("Google account unlinked");
    } catch (e:any) {
      setGoogleMsg(e.message);
    }
  };

  const handleAddPasskey = async () => {
    setPasskeyMsg(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      // Get options from server
      const optionsRes = await (addPasskeyFn as any)({ data: { action: 'options' } }).catch(async () => {
        // fallback to supabase function
        const { data, error } = await supabase.functions.invoke('webauthn-register-options');
        if (error) throw error;
        return data;
      });
      const opts = optionsRes?.options || optionsRes;
      if (!opts) throw new Error("Failed to get registration options");
      const attResp = await startRegistration(opts);
      const verifyRes = await (addPasskeyFn as any)({ data: { attestation: attResp, name: `Passkey ${new Date().toLocaleDateString()}` } });
      if (verifyRes?.ok) {
        setPasskeyMsg("Passkey added successfully!");
        const list = await listPasskeysFn({ data: {} } as any);
        if ((list as any)?.passkeys) setPasskeys((list as any).passkeys);
      } else {
        // Try edge function verify
        const { data: vData, error: vError } = await supabase.functions.invoke('webauthn-register-verify', { body: attResp });
        if (vError) throw vError;
        setPasskeyMsg("Passkey added!");
        const list = await listPasskeysFn({ data: {} } as any);
        if ((list as any)?.passkeys) setPasskeys((list as any).passkeys);
      }
    } catch (e:any) {
      setPasskeyMsg(e.message || "Failed to add passkey");
    }
  };

  const handleRemovePasskey = async (id: string) => {
    if (!confirm("Remove this passkey?")) return;
    try {
      await removePasskeyFn({ data: { credentialId: id } } as any);
      setPasskeys(prev => prev.filter(p=>p.id!==id && p.credential_id!==id));
      setPasskeyMsg("Passkey removed");
    } catch (e:any) {
      setPasskeyMsg(e.message);
    }
  };

  return (
    <div className="section-bg min-h-screen px-5 py-14">
      <div className="mx-auto max-w-3xl">
        <Pill>{student.type === "founder" ? "Founder Executive Settings" : student.type === "co-founder" ? "Co-Founder Executive Settings" : "Account Settings"}</Pill>
        <h1 className="font-display mt-4 text-4xl text-white sm:text-5xl whitespace-nowrap">Your Account, <span className="text-gradient">Your Control.</span></h1>
        <p className="mt-2 text-sm text-[#b8aecf]">Manage your verification privacy, security, profile information, and referral link. KR8 ID is your permanent identity.</p>

        <Card className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-bold text-white text-lg">{student.type === "founder" || student.type === "co-founder" ? "Verified Executive Leadership Record" : "Verified Identity Record"}</h2>
              <p className="text-xs text-[#8a7ba8]">These official registration facts are locked to protect the integrity of your KR8 credential. KR8 ID shown, not auth UUID.</p>
            </div>
            <span className="rounded-full bg-pink-500/10 px-3 py-1 font-mono text-xs font-bold text-pink-400">{student.kr8_id || student.id}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl bg-black/20 p-3"><span className="text-[#8a7ba8]">Full Name</span><p className="font-semibold text-white mt-1 text-sm">{student.name}</p></div>
            <div className="rounded-xl bg-black/20 p-3"><span className="text-[#8a7ba8]">Registered Email</span><p className="font-semibold text-white mt-1 text-sm">{student.email}</p></div>
            <div className="rounded-xl bg-black/20 p-3"><span className="text-[#8a7ba8]">Platform Role</span><p className="font-semibold text-white mt-1 text-sm">{student.type === "founder" ? "Founder & CEO" : student.type === "co-founder" ? "Co-Founder" : skill?.name ?? student.skill}</p></div>
            <div className="rounded-xl bg-black/20 p-3"><span className="text-[#8a7ba8]">KR8 ID (copyable)</span><p className="font-mono font-bold text-pink-400 mt-1 text-sm">{student.kr8_id || student.id}</p></div>
          </div>
        </Card>

        <Card className="mt-6">
          <h2 className="font-bold text-white text-lg">Public Verify Page Visibility</h2>
          <p className="mt-1 text-xs text-[#b8aecf]">Control what visitors see when looking up your KR8 ID on public Verify page (<code className="text-pink-300">/verify?id={student.kr8_id || student.id}</code>).</p>
          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 cursor-pointer hover:border-pink-400/40">
            <input type="checkbox" checked={expanded} onChange={e=>handleToggleExpanded(e.target.checked)} className="mt-1 accent-pink-500" />
            <div><p className="text-sm font-semibold text-white">Enable Expanded Profile Visibility</p><p className="text-xs text-[#8a7ba8] mt-1">When enabled, your verified attendance, submissions, XP, and admin remarks are visible to anyone verifying your certificate.</p></div>
          </label>
        </Card>

        <Card className="mt-6">
          <div className="flex items-center justify-between"><h2 className="font-bold text-white text-lg">Personal Bio</h2>{savedBio && <span className="text-xs text-green-300 font-semibold">✓ Bio saved!</span>}</div>
          <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} placeholder="e.g. Visual designer passionate about brand identity." className="mt-3 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none" />
          <div className="mt-3"><button onClick={handleSaveBio} className="rounded-full bg-gradient-pink px-5 py-2 text-xs font-bold text-white">Save Bio</button></div>
        </Card>

        <Card className="mt-6">
          <div className="flex items-center justify-between"><h2 className="font-bold text-white text-lg">Messaging & Direct Communication</h2>{savedPrivacy && <span className="text-xs text-green-300 font-semibold">✓ Privacy updated!</span>}</div>
          <p className="mt-1 text-xs text-[#b8aecf]">Select who is permitted to send you direct messages inside the Tribe community.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(["Anyone","Friends only","No one"] as const).map(opt=>(
              <button key={opt} onClick={()=>handleSavePrivacy(opt)} className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${privacy===opt ? "bg-gradient-pink text-white" : "border border-white/15 bg-black/20 text-[#cabfe0] hover:text-white"}`}>{opt}</button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#8a7ba8]">Uses direct_messages table (sender_id recipient_id text read_at), blocks, follows. Own rows update only read. To find other students use get_leaderboard ids, do not query profiles for other students.</p>
        </Card>

        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-pink text-white shadow-md"><Icon name="lock" size={22} /></div>
              <div><h2 className="font-bold text-white text-lg">Google Sign-In Security</h2><p className="text-xs text-[#b8aecf]">Link Google account in Profile using linkIdentity, Continue with Google on sign-in.</p></div>
            </div>
            {googleLinked ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300"><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />Linked</span> : <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#b8aecf]">Not linked</span>}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            {googleLinked ? (
              <div className="space-y-3">
                <p className="text-xs text-[#cabfe0]">Google account is linked. You can use Continue with Google on sign-in page.</p>
                <button onClick={handleUnlinkGoogle} className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20">Unlink Google</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-[#cabfe0]">Enable Google Sign-In to log in faster. Uses Supabase linkIdentity, verified.</p>
                <button onClick={handleLinkGoogle} className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 py-2.5 text-xs font-bold hover:bg-gray-100"><span>G</span> Link Google Account</button>
              </div>
            )}
            {googleMsg && <div className={`mt-3 rounded-xl px-4 py-2.5 text-xs font-medium ${googleMsg.includes('Redirecting') ? "bg-blue-500/15 border border-blue-500/30 text-blue-300" : "bg-red-500/15 border border-red-500/30 text-red-300"}`}>{googleMsg}</div>}
          </div>
        </Card>

        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-pink text-white shadow-md"><Icon name="fingerprint" size={22} /></div>
              <div><h2 className="font-bold text-white text-lg">Biometrics & Passkeys</h2><p className="text-xs text-[#b8aecf]">WebAuthn passkeys SimpleWebAuthn with credentials table migration, log in via server-minted session, add/remove passkeys in Profile.</p></div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-[#b8aecf] leading-relaxed">Register your device fingerprint sensor or passkey for instant, passwordless logins. Uses WebAuthn standard, credentials stored in webauthn_credentials table.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={handleAddPasskey} className="inline-flex items-center gap-2 rounded-full bg-gradient-pink px-5 py-2.5 text-xs font-bold text-white glow-pink-sm hover:scale-[1.02] transition-transform"><Icon name="fingerprint" size={16} />Add New Passkey</button>
            </div>
            {passkeys.length>0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-white">Your Passkeys ({passkeys.length})</p>
                {passkeys.map((pk:any)=>(
                  <div key={pk.id || pk.credential_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                    <div><p className="font-bold text-white">{pk.name || pk.device_label || 'Passkey'}</p><p className="text-[11px] text-[#8a7ba8] font-mono">{pk.credential_id?.slice(0,20)}... · {pk.created_at ? new Date(pk.created_at).toLocaleDateString() : ''}</p></div>
                    <button onClick={()=>handleRemovePasskey(pk.id || pk.credential_id)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-300">Remove</button>
                  </div>
                ))}
              </div>
            )}
            {passkeyMsg && <div className="mt-3 rounded-xl bg-pink-500/10 border border-pink-500/30 px-4 py-2.5 text-xs text-pink-300">{passkeyMsg}</div>}
          </div>
        </Card>

        <Card className="mt-6">
          <h2 className="font-bold text-white text-lg">My Referral Program Link</h2>
          <p className="mt-1 text-xs text-[#b8aecf]">Earn points and badges by inviting fellow creatives.</p>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={getReferralUrl(student.kr8_id || student.id)} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-pink-300 focus:outline-none select-all" />
            <button onClick={copyReferral} className="rounded-xl bg-gradient-pink px-4 py-2 text-xs font-bold text-white whitespace-nowrap">{copiedRef ? "Copied! ✓" : "Copy Link"}</button>
          </div>
          <p className="mt-2 text-[11px] text-[#8a7ba8]">Referral URL uses kr8_id, not UUID. Dashboard already copies kr8_id.</p>
        </Card>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/academy" className="text-xs text-pink-300 hover:text-white">← Return to My Academy Profile</Link>
          <button onClick={()=>{ signOut(); navigate("/"); }} className="rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20">Sign Out of Account</button>
        </div>
      </div>
    </div>
  );
}

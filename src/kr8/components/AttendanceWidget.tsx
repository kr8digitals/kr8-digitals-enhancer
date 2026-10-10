// World-class Attendance Widget - date/topic/time, pending approval, smart scheduling
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, Pill } from "./ui";
import Icon from "./Icon";
import { getAttendanceStatus, getLagosTimeString, formatNextOpen, getLagosNow, type AttendanceType } from "../lib/attendance";

const inputCls = "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none transition-colors";
const labelCls = "block text-xs font-bold text-[#cabfe0] mb-1.5";

function safeArray<T>(v: any, fallback: T[] = []): T[] { return Array.isArray(v) ? v : fallback; }

export default function AttendanceWidget({ student }: { student: any }) {
  const { addNotification } = useAuth() as any;
  const [type, setType] = useState<AttendanceType | "">("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [topic, setTopic] = useState("");
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0,5));
  const [proofText, setProofText] = useState("");
  const [fileName, setFileName] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean | null>>({});
  const [lagosNow, setLagosNow] = useState(() => getLagosNow());
  const [stats, setStats] = useState({ streak: 0, total: 0, class: 0, assignment: 0, mindset: 0, hangout: 0 });

  const sync = async () => {
    try {
      const { data: subs } = await supabase.from('attendance_submissions').select('*').eq('user_id', student.id).order('created_at', { ascending: false }).limit(50);
      if (subs) setSubmissions(subs);
      const { data: setData } = await supabase.from('attendance_settings').select('type,is_open');
      if (setData) {
        const map: Record<string, boolean | null> = {};
        setData.forEach((r: any) => map[r.type] = r.is_open);
        setSettings(map);
      }
      const { data: profile } = await supabase.from('profiles').select('streak_days,attendance_accepted,total_class_attendance,total_assignment_attendance,total_mindset_attendance,total_hangout_attendance').eq('id', student.id).maybeSingle();
      if (profile) {
        setStats({
          streak: profile.streak_days || 0,
          total: profile.attendance_accepted || subs?.filter((s: any) => s.status === 'approved').length || 0,
          class: profile.total_class_attendance || 0,
          assignment: profile.total_assignment_attendance || 0,
          mindset: profile.total_mindset_attendance || 0,
          hangout: profile.total_hangout_attendance || 0,
        });
      }
    } catch {}
  };

  useEffect(() => {
    sync();
    const iv = setInterval(() => { setLagosNow(getLagosNow()); }, 60000);
    const handler = () => sync();
    window.addEventListener('kr8:attendance-updated', handler);
    return () => { clearInterval(iv); window.removeEventListener('kr8:attendance-updated', handler); };
  }, [student.id]);

  const getStatus = (t: AttendanceType) => getAttendanceStatus(t, settings as any, lagosNow);

  const currentStatus = type ? getStatus(type as AttendanceType) : null;
  const isOpen = currentStatus?.isOpen || false;
  const gradLocked = student.graduated && (type === 'class' || type === 'assignment');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { addNotification?.('Image max 10MB'); return; }
    setFileName(file.name);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const name = `${student.id}/attendance/${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
      const { data, error } = await supabase.storage.from('user-uploads').upload(name, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('user-uploads').getPublicUrl(data.path);
      setProofImageUrl(pub.publicUrl);
    } catch (err: any) {
      // Fallback to base64 preview if Storage fails (e.g. bucket not exists yet)
      const reader = new FileReader();
      reader.onload = () => setProofImageUrl(String(reader.result));
      reader.readAsDataURL(file);
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!type) { addNotification?.('Select attendance type'); return; }
    if (type !== 'class' && type !== 'assignment') {
      addNotification?.('Mindset Shift and Hangout are auto-marked via live stream — join the live to get attendance');
      return;
    }
    if (!date) { addNotification?.('Date required'); return; }
    if (!topic.trim() || topic.trim().length < 3) { addNotification?.('Topic required, min 3 chars'); return; }
    if (!time) { addNotification?.('Time required'); return; }

    try {
      const { data, error } = await supabase.rpc('submit_attendance', {
        p_user_id: student.id,
        p_kr8_id: student.kr8_id,
        p_type: type,
        p_date: date,
        p_topic: topic.trim(),
        p_time: time,
        p_proof_text: proofText.trim() || `Attended ${type} on ${date} about ${topic}`,
        p_proof_image_url: proofImageUrl || null,
      });
      if (error) throw error;
      setDone(true);
      addNotification?.(`✅ ${type} attendance submitted for ${date} — pending admin approval. Dashboard updates after approval.`);
      // Reset form
      setTopic(""); setProofText(""); setFileName(""); setProofImageUrl("");
      sync();
      window.dispatchEvent(new Event('kr8:attendance-updated'));
    } catch (e: any) {
      addNotification?.(`❌ Submit failed: ${e.message}`);
    }
  };

  const lastSub = submissions[0];

  return (
    <div className="space-y-6">
      {/* Journey header - celebrates wins */}
      <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-[#1a0030]/60 to-[#12001f] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-pink-400">Your Learning Journey</p>
            <h3 className="mt-1 font-display text-xl font-black text-white">🔥 {stats.streak} Day Streak · {stats.total} Approved</h3>
            <p className="mt-1 text-xs text-[#b8aecf]">Class {stats.class} · Assignment {stats.assignment} · Mindset {stats.mindset} · Hangout {stats.hangout} · Lagos: {getLagosTimeString(lagosNow)}</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-300">XP: {student.points || 0}</span>
            <span className="rounded-full bg-pink-500/20 border border-pink-500/30 px-3 py-1 text-[11px] font-bold text-pink-300">Level {student.level || 1}</span>
          </div>
        </div>
      </div>

      {lastSub && (
        <div className={`rounded-2xl border p-4 text-xs ${lastSub.status === "approved" ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200" : lastSub.status === "rejected" ? "border-red-500/40 bg-red-950/20 text-red-200" : "border-amber-500/40 bg-amber-950/20 text-amber-200"}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold uppercase text-[11px]">Latest: {lastSub.type} on {lastSub.attendance_date || new Date(lastSub.created_at).toLocaleDateString()}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${lastSub.status === "approved" ? "bg-emerald-500/30 text-emerald-300" : lastSub.status === "rejected" ? "bg-red-500/30 text-red-300" : "bg-amber-500/30 text-amber-300"}`}>{lastSub.status === "approved" ? "Approved ✓" : lastSub.status === "rejected" ? "Rejected ✕" : "Pending Review ⏳"}</span>
          </div>
          <p className="mt-2 text-sm text-white">"{lastSub.attendance_topic || lastSub.topic || lastSub.proof_text}" {lastSub.status === "approved" ? <span className="text-emerald-400 font-semibold">— approved{lastSub.admin_warning ? ` with warning: ${lastSub.admin_warning}` : ''}. Dashboard updated!</span> : lastSub.status === "rejected" ? <span className="text-red-300 font-semibold">— rejected: "{lastSub.admin_comment || lastSub.feedback || 'Please resubmit'}"</span> : <span className="text-amber-300">— pending admin review, dashboard will update after approval.</span>}</p>
          {lastSub.admin_comment && lastSub.status === 'approved' && <p className="mt-1 text-[11px] text-[#8a7ba8]">Admin note: {lastSub.admin_comment}</p>}
        </div>
      )}

      {done ? (
        <Card className="text-center py-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"><Icon name="check" size={28} /></div>
          <h3 className="text-xl font-black text-white">Attendance Submitted! 🎉</h3>
          <p className="mt-2 text-sm text-[#b8aecf] max-w-md mx-auto">Your {type} attendance for {date} about "{topic}" is now pending. An admin will review and approve/reject with comment. Your dashboard updates only after approval — that's when XP and streak increase and you appear in live feed.</p>
          <button onClick={() => { setDone(false); setType(""); }} className="mt-6 rounded-full bg-gradient-pink px-6 py-2.5 text-sm font-bold text-white shadow-lg">Submit Another →</button>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display font-black text-white text-xl">Mark Attendance · Smart Schedule</h3>
            <Pill className="text-[10px]">Lagos {getLagosTimeString(lagosNow).split(',').pop()}</Pill>
          </div>
          <p className="mt-2 text-xs text-[#8a7ba8]">Class & Assignment require date/topic/time and go pending until admin approves. Mindset & Hangout are auto-marked when you join live stream during attendance window.</p>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {(['class','assignment','mindset','hangout'] as AttendanceType[]).map((t) => {
              const st = getStatus(t);
              return (
                <button key={t} onClick={() => setType(t)} className={`rounded-2xl border p-3.5 text-left transition-all hover:scale-[1.02] ${type === t ? "border-pink-400/60 bg-pink-500/15 text-white shadow-md shadow-pink-500/10" : "border-white/10 bg-white/[0.02] text-[#b8aecf] hover:border-white/20"}`}>
                  <div className="flex items-center justify-between"><span className="font-bold text-sm capitalize">{t}</span><span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${st.isOpen ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-white/10 text-[#8a7ba8] border-white/10"}`}>{st.isOpen ? "OPEN" : "CLOSED"}</span></div>
                  <p className="mt-1.5 text-[11px] text-[#8a7ba8] leading-snug">{st.schedule}</p>
                  <p className="mt-1 text-[10px] text-[#6a5b82]">{st.isOpen ? st.reason.slice(0,60) : `Next: ${formatNextOpen(st.nextOpen)}`}</p>
                </button>
              );
            })}
          </div>

          {type && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
              {currentStatus && (
                <div className={`rounded-xl p-3 text-xs ${currentStatus.isOpen ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200" : "bg-amber-500/10 border border-amber-500/20 text-amber-200"}`}>
                  <p className="font-bold">{currentStatus.isOpen ? "✅ Open" : "⏳ Closed"} — {currentStatus.reason}</p>
                  {!currentStatus.isOpen && currentStatus.nextOpen && <p className="mt-1 text-[11px]">Next open: {currentStatus.nextOpen.toLocaleString()} ({formatNextOpen(currentStatus.nextOpen)}) — Admin can override to open.</p>}
                </div>
              )}

              {gradLocked ? (
                <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">🎓 Graduated students no longer submit Class & Assignment — your journey continues in Tribe & Agency.</p>
              ) : type === 'mindset' || type === 'hangout' ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                    <h4 className="font-bold text-white text-sm">🤖 Auto-Marked via Live Stream</h4>
                    <p className="mt-1 text-xs text-[#b8aecf] leading-relaxed">Mindset Shift is 1st & 3rd Sundays, Hangout is last Sunday, 7PM-11PM WAT. Attendance window 10PM-11PM. Just join the live stream (audio/video) during that window — your profile is automatically linked if you're signed in. If not signed in, site will ask for your KR8 ID to record attendance. No account needed to join live, but account needed to save attendance to profile.</p>
                    <div className="mt-3 flex gap-2"><a href="/live" className="rounded-full bg-gradient-pink px-4 py-2 text-xs font-bold text-white">Join Live Stream →</a><span className="text-[11px] text-[#8a7ba8] self-center">Auto-records everyone in stream</span></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><label className={labelCls}>Date * (when you attended)</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} max={new Date().toISOString().slice(0,10)} /></div>
                    <div><label className={labelCls}>Time * (when)</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Topic * (what you learned)</label><input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Figma Auto-Layout, React Hooks" className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Proof / Notes (optional but helps approval)</label><textarea value={proofText} onChange={e => setProofText(e.target.value)} placeholder="What did you do in class? Link to assignment, screenshot description..." rows={3} className={inputCls} /></div>
                  <div>
                    <label className={labelCls}>Upload Proof Image (optional, max 10MB) — Stored in user-uploads/{student.id}/attendance</label>
                    <label className="block cursor-pointer rounded-xl border border-dashed border-white/20 bg-black/20 px-4 py-6 text-center text-sm text-[#8a7ba8] hover:border-pink-400/50 transition">
                      <span className="inline-flex items-center gap-2">{uploading ? "Uploading..." : fileName ? <><Icon name="paperclip" size={15} /> <span className="text-pink-300 font-semibold">{fileName}</span> {proofImageUrl && <span className="text-emerald-400">✓ Uploaded</span>}</> : "Click to upload screenshot / assignment proof"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    {proofImageUrl && proofImageUrl.startsWith('http') && <img src={proofImageUrl} alt="Proof" className="mt-3 h-32 w-auto rounded-xl border border-white/10 object-cover" />}
                  </div>
                  <button onClick={submit} disabled={uploading || !isOpen} className="w-full rounded-xl bg-gradient-pink px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-pink-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] transition-all">Submit for Admin Review → Pending Until Approved</button>
                  <p className="text-[10px] text-[#6a5b82] text-center">Your dashboard, XP, streak, and live feed only update after admin approves. Rejection requires reason. Approval can include warning.</p>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {submissions.length > 0 && (
        <Card className="p-5">
          <h4 className="font-bold text-white">Your Attendance Journey · {submissions.length} submissions</h4>
          <p className="text-[11px] text-[#8a7ba8] mt-1">Celebrating every win — approved attendance appears in live feed and boosts your rank.</p>
          <div className="mt-4 space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {safeArray(submissions).map((sub: any) => (
              <div key={sub.id} className="rounded-2xl border border-white/5 bg-black/30 p-3.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-white capitalize text-xs">{sub.type}</span>
                  <span className="text-[#8a7ba8]">·</span>
                  <span className="text-[#cabfe0] text-xs font-semibold">{sub.attendance_date || new Date(sub.created_at).toLocaleDateString()} {sub.attendance_time ? `at ${sub.attendance_time}` : ''}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase border ${sub.status === "approved" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : sub.status === "rejected" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>{sub.status}</span>
                  {sub.auto_marked && <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-300">AUTO LIVE</span>}
                  {sub.admin_warning && <span className="rounded-full bg-yellow-500/20 border border-yellow-500/30 px-2 py-0.5 text-[9px] font-bold text-yellow-300">⚠️ Warning</span>}
                </div>
                <p className="text-sm text-white font-semibold">"{sub.attendance_topic || sub.topic || sub.proof_text?.slice(0,80)}"</p>
                {sub.proof_image_url && <a href={sub.proof_image_url} target="_blank" rel="noreferrer" className="text-[11px] text-pink-400 underline">View Proof Image ↗</a>}
                {sub.admin_comment && <p className="text-[11px] text-[#8a7ba8]"><strong className={sub.status === 'rejected' ? 'text-red-300' : 'text-emerald-300'}>{sub.status === 'rejected' ? 'Rejection Reason:' : 'Admin Note:'}</strong> {sub.admin_comment}</p>}
                {sub.admin_warning && <p className="text-[11px] text-yellow-300/80"><strong>Warning:</strong> {sub.admin_warning}</p>}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#6a5b82]">{sub.live_purpose ? `Live: ${sub.live_purpose}` : ''} {sub.points_awarded ? `· +${sub.points_awarded}pts` : ''}</span>
                  <span className="text-[10px] text-[#6a5b82]">{new Date(sub.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

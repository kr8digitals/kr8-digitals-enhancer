// World-class student profile journey — celebrates wins, streaks, level, badges, synced activities
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Pill } from "./ui";
import Icon from "./Icon";
import { getLagosTimeString, getLagosNow } from "../lib/attendance";

export default function ProfileJourney({ student }: { student: any }) {
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [levelProgress, setLevelProgress] = useState({ current: 0, next: 100, pct: 0 });

  const load = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', student.id).maybeSingle();
      if (data) {
        setProfile(data);
        const pts = data.points || 0;
        const lvl = data.level || Math.floor(pts / 100) + 1;
        const cur = pts % 100;
        setLevelProgress({ current: cur, next: 100, pct: cur });
        if (data.badges) {
          try { setBadges(Array.isArray(data.badges) ? data.badges : JSON.parse(data.badges as any)); } catch { setBadges([]); }
        }
      }
      const { data: logs } = await supabase.from('activity_log').select('*').eq('actor_id', student.id).order('created_at', { ascending: false }).limit(20);
      if (logs) setActivities(logs);
    } catch {}
  };

  useEffect(() => { load(); const iv = setInterval(load, 60000); window.addEventListener('kr8:attendance-updated', load); return () => { clearInterval(iv); window.removeEventListener('kr8:attendance-updated', load); }; }, [student.id]);

  const p = profile || student;
  const streak = p.streak_days || 0;
  const longest = p.longest_streak || 0;
  const totalApproved = p.attendance_accepted || 0;

  return (
    <div className="space-y-5">
      {/* Celebration header */}
      <div className="rounded-[28px] border border-pink-500/20 bg-gradient-to-br from-[#1a0030] via-[#12001f] to-black p-6 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-pink-400">Your Journey · Celebrating Every Win 🎉</p>
              <h2 className="mt-2 font-display text-2xl font-black text-white leading-tight">Hey {p.name?.split(' ')[0] || 'Champion'}! <br />You're on fire 🔥</h2>
              <p className="mt-2 text-xs text-[#b8aecf] max-w-lg leading-relaxed">Every class, assignment, mindset shift & hangout syncs to your profile. Wins appear in live feed so tribe celebrates with you. Keep streak alive — Lagos now {getLagosTimeString(getLagosNow())}</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-3">
                <p className="text-[10px] uppercase text-[#8a7ba8] font-bold">Streak</p>
                <p className="text-2xl font-black text-white">🔥 {streak} days</p>
                <p className="text-[11px] text-[#8a7ba8]">Longest {longest} · {totalApproved} approved</p>
              </div>
              <div className="rounded-2xl bg-gradient-pink px-5 py-3 shadow-lg shadow-pink-500/20">
                <p className="text-[10px] uppercase text-white/70 font-bold">Level {p.level || 1} · {p.points || 0} XP</p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/30 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${levelProgress.pct}%` }} /></div>
                <p className="mt-1 text-[10px] text-white/80">{levelProgress.current}/{levelProgress.next} to next level</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { k: 'Class', v: p.total_class_attendance || 0, icon: 'book', color: 'blue' },
              { k: 'Assignment', v: p.total_assignment_attendance || 0, icon: 'pen', color: 'purple' },
              { k: 'Mindset', v: p.total_mindset_attendance || 0, icon: 'spark', color: 'pink' },
              { k: 'Hangout', v: p.total_hangout_attendance || 0, icon: 'users', color: 'orange' },
            ].map(item => (
              <div key={item.k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase font-bold text-[#8a7ba8]">{item.k}</p>
                <p className="mt-1 text-xl font-black text-white">{item.v}</p>
                <p className="text-[10px] text-[#6a5b82]">Approved</p>
              </div>
            ))}
          </div>

          {badges.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase text-[#8a7ba8]">Badges Earned 🏆</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {badges.map((b: any, i: number) => (
                  <span key={i} className="rounded-full bg-yellow-500/15 border border-yellow-500/30 px-3 py-1 text-[11px] font-bold text-yellow-300">{typeof b === 'string' ? b : b.name || b.title || JSON.stringify(b)}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2 flex-wrap">
            <a href="/live" className="rounded-full bg-white text-black px-5 py-2.5 text-xs font-black hover:scale-105 transition">Join Live → Auto Attendance</a>
            <a href="#attendance" className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/10">Mark Attendance</a>
            <span className="self-center text-[11px] text-[#8a7ba8]">Mindset 1st & 3rd Sun · Hangout last Sun · 10PM-11PM WAT</span>
          </div>
        </div>
      </div>

      {/* Activity sync feed */}
      <Card className="p-5">
        <h3 className="font-bold text-white">Your Synced Activity · Live Feed Ready</h3>
        <p className="text-[11px] text-[#8a7ba8] mt-1">Every action synced to profile and celebrated in tribe live feed when approved.</p>
        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
          {activities.length === 0 && <p className="text-xs text-[#6a5b82]">No activity yet — submit attendance or join live to start journey.</p>}
          {activities.map((a: any) => (
            <div key={a.id} className="rounded-xl border border-white/5 bg-black/20 p-3 flex justify-between gap-2">
              <div><p className="text-xs font-bold text-white">{a.action?.replaceAll('_',' ')} · <span className="text-[#8a7ba8] font-normal">{a.target}</span></p><p className="text-[11px] text-[#6a5b82]">{a.details ? JSON.stringify(a.details).slice(0,100) : ''}</p></div>
              <span className="text-[10px] text-[#6a5b82] shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

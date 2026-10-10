// Production Granular Permissions Manager - DB-based, only founder can promote
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { promoteUser, demoteUser, updatePermissions } from "@/lib/roles.functions";
import { Card, Pill } from "../ui";
import Icon from "../Icon";

export const ALL_ADMIN_SECTIONS = [
  { id: "Overview", label: "Overview & Analytics", group: "Core", perm: "view_analytics" },
  { id: "Website Content (CMS)", label: "Website Content (Dynamic CMS)", group: "Content", perm: "manage_content" },
  { id: "Announcements", label: "Announcements", group: "Content", perm: "manage_announcements" },
  { id: "Blog", label: "Blog & Insights", group: "Content", perm: "manage_blog" },
  { id: "Gallery Archive", label: "Gallery Archive", group: "Content", perm: "manage_gallery" },
  { id: "Links Manager", label: "Links & Redirects", group: "Content", perm: "manage_links" },
  { id: "Student Management", label: "Student Management", group: "Academy", perm: "view_students" },
  { id: "Attendance Review", label: "Attendance Review", group: "Academy", perm: "manage_attendance" },
  { id: "Graduation & Certificates", label: "Graduation & Certificates", group: "Academy", perm: "issue_certificates" },
  { id: "Coach & Admin Signatures", label: "Coach & Admin Signatures", group: "Academy", perm: "manage_signatures" },
  { id: "Verify Remarks", label: "Verify Remarks", group: "Academy", perm: "manage_verify" },
  { id: "Leaderboard & XP", label: "Leaderboard & XP", group: "Academy", perm: "manage_leaderboard" },
  { id: "Academy", label: "Academy Courses", group: "Academy", perm: "manage_academy" },
  { id: "Home", label: "Home Page Settings", group: "Content", perm: "manage_home" },
  { id: "Testimonial Videos", label: "Testimonial Videos", group: "Media", perm: "manage_testimonials" },
  { id: "Live Streams & Replays", label: "Live Streams & Replays", group: "Media", perm: "manage_live_rooms" },
  { id: "Client Requests", label: "Client Inquiries", group: "Media", perm: "manage_clients" },
  { id: "Agency", label: "Agency Portfolio", group: "Media", perm: "manage_agency" },
  { id: "Founders & Partners", label: "Founders & Team", group: "System", perm: "manage_founders" },
  { id: "Payment Settings", label: "Payment & Accounts", group: "System", perm: "manage_payments" },
  { id: "Moderation", label: "Community Moderation", group: "Operations", perm: "manage_moderation" },
  { id: "Admin Permissions", label: "Staff & Permissions", group: "System", perm: "manage_roles", ultimateOnly: true },
];

export const ROLE_PRESETS: Record<string, { label: string; description: string; permissions: string[] }> = {
  attendance_reviewer: {
    label: "Attendance Reviewer",
    description: "Strictly limited to attendance review only. Zero access to student records or system settings.",
    permissions: ["manage_attendance"],
  },
  admin: {
    label: "Standard Admin",
    description: "Operational management with granular permissions.",
    permissions: ["view_students", "manage_attendance", "issue_certificates", "manage_content", "manage_announcements"],
  },
  coach: {
    label: "Academy Coach",
    description: "Access to student coursework and academy.",
    permissions: ["view_students", "manage_academy", "manage_attendance"],
  },
  moderator: {
    label: "Community Moderator",
    description: "Community safety and moderation.",
    permissions: ["manage_moderation"],
  },
};

type ProfileWithRoles = {
  id: string;
  kr8_id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: { role: string; title: string | null; permissions: string[] }[];
};

export default function GranularPermissionsManager({ isUltimate }: { isUltimate: boolean }) {
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProfileWithRoles | null>(null);
  const [assignedRole, setAssignedRole] = useState("admin");
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const promoteFn = useServerFn(promoteUser);
  const demoteFn = useServerFn(demoteUser);
  const updatePermsFn = useServerFn(updatePermissions);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data: profilesData } = await supabase.from('profiles').select('id, kr8_id, name, email, phone').limit(100);
      const { data: rolesData } = await supabase.from('user_roles').select('*');

      const merged: ProfileWithRoles[] = (profilesData || []).map((p: any) => ({
        ...p,
        roles: (rolesData || []).filter((r: any) => r.user_id === p.id).map((r: any) => ({
          role: r.role,
          title: r.title,
          permissions: r.permissions || [],
        }))
      }));

      setProfiles(merged);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
    const channel = supabase.channel('roles-manager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, loadProfiles)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadProfiles)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.kr8_id.toLowerCase().includes(q);
  });

  const handlePromote = async () => {
    if (!selected) return;
    setFeedback(null);
    try {
      await promoteFn({ data: { targetUserId: selected.id, role: assignedRole as any, permissions: customPermissions } });
      setFeedback({ type: "success", msg: `Promoted ${selected.name} to ${assignedRole}` });
      loadProfiles();
    } catch (e: any) {
      setFeedback({ type: "error", msg: e.message || "Failed to promote" });
    }
  };

  const handleDemote = async (profile: ProfileWithRoles, role: string) => {
    if (!confirm(`Demote ${profile.name} from ${role}?`)) return;
    try {
      await demoteFn({ data: { targetUserId: profile.id, role } });
      setFeedback({ type: "success", msg: `Demoted ${profile.name} from ${role}` });
      loadProfiles();
    } catch (e: any) {
      setFeedback({ type: "error", msg: e.message });
    }
  };

  if (!isUltimate) {
    return (
      <Card className="p-6 text-center">
        <Icon name="lock" size={24} className="mx-auto mb-2 text-red-400" />
        <p className="text-sm text-[#b8aecf]">Only founder can manage roles and permissions. Users cannot change own role.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Role & Permission Control</h2>
          <p className="mt-1 text-xs text-[#b8aecf]">Only founder can promote/demote. Users cannot change own role. Phone alone never grants admin.</p>
        </div>
        <Pill>{profiles.length} Users</Pill>
      </div>

      {feedback && (
        <div className={`rounded-xl p-3 text-xs font-semibold ${feedback.type === "success" ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {feedback.msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Users</h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, KR8 ID..."
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-xs text-white placeholder-[#8a7ba8] mb-4"
          />
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loading ? <p className="text-xs text-[#8a7ba8]">Loading...</p> : filtered.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between ${selected?.id === p.id ? "border-pink-500/60 bg-pink-500/15" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}
              >
                <div>
                  <div className="font-semibold text-xs text-white">{p.name}</div>
                  <div className="text-[11px] text-[#8a7ba8]">{p.email} · {p.kr8_id}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {p.roles.map(r => (
                      <span key={r.role} className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {r.role}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-pink-400">→</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          {selected ? (
            <div className="space-y-4">
              <h3 className="font-bold text-white">Manage {selected.name}</h3>
              <p className="text-xs text-[#8a7ba8]">{selected.email} · {selected.kr8_id} · {selected.phone}</p>

              <div>
                <label className="block text-xs font-semibold text-[#b8aecf] mb-2">Promote to Role</label>
                <select value={assignedRole} onChange={e => setAssignedRole(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white">
                  <option value="admin">Admin</option>
                  <option value="coach">Coach</option>
                  <option value="moderator">Moderator</option>
                  <option value="attendance_reviewer">Attendance Reviewer</option>
                  <option value="co-founder">Co-Founder</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#b8aecf] mb-2">Permissions</label>
                <div className="grid gap-1 max-h-[200px] overflow-y-auto">
                  {ALL_ADMIN_SECTIONS.filter(s => !s.ultimateOnly).map(sec => (
                    <label key={sec.perm} className="flex items-center gap-2 text-xs text-[#8a7ba8] hover:text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPermissions.includes(sec.perm)}
                        onChange={e => {
                          if (e.target.checked) setCustomPermissions([...customPermissions, sec.perm]);
                          else setCustomPermissions(customPermissions.filter(p => p !== sec.perm));
                        }}
                        className="rounded"
                      />
                      {sec.label} ({sec.perm})
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={handlePromote} className="w-full rounded-full bg-gradient-pink py-2.5 text-xs font-bold text-white">
                Promote to {assignedRole}
              </button>

              <div className="border-t border-white/10 pt-3">
                <p className="text-xs font-semibold text-[#b8aecf] mb-2">Current Roles - Click to Demote</p>
                {selected.roles.map(r => (
                  <div key={r.role} className="flex items-center justify-between py-1">
                    <span className="text-xs text-white">{r.role} - {r.title}</span>
                    <button onClick={() => handleDemote(selected, r.role)} className="text-xs text-rose-400 hover:text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded">
                      Demote
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon name="shield" className="h-8 w-8 mx-auto text-[#8a7ba8] mb-2" />
              <p className="text-xs text-[#8a7ba8]">Select a user to manage roles</p>
              <p className="text-[11px] text-[#6b5d84] mt-1">Only founder can promote. No self-promotion. Phone alone never grants admin.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { endRoom, hideRecording, listRoomParticipants } from "@/lib/live.functions";
import { useAuth } from "../../context/AuthContext";
import { Link } from "../../router-shim";
import ShareRoom from "../../live/ShareRoom";
import "../../live/live.css";

const box = "rounded-2xl border border-white/10 bg-[#19111F] p-4";

export default function LiveControlCenter() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [recs, setRecs] = useState([]);
  const [log, setLog] = useState([]);
  const [people, setPeople] = useState({});
  const end = useServerFn(endRoom);
  const hide = useServerFn(hideRecording);
  const list = useServerFn(listRoomParticipants);

  useEffect(() => {
    const load = () => {
      supabase.from("live_rooms").select("*").eq("is_live", true).order("started_at", { ascending: false }).then(({ data }) => setRooms(data || []));
      supabase.from("recordings").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => setRecs(data || []));
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(60).then(({ data }) => setLog(data || []));
    };
    load();
    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "recordings" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!user?.id || rooms.length === 0) return;
    const tick = () => rooms.forEach((r) => list({ data: { userId: user.id, roomId: r.id } }).then((p) => setPeople((x) => ({ ...x, [r.id]: p }))).catch(() => {}));
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [user?.id, rooms.map((r) => r.id).join()]);

  const fail = (e) => alert(e?.message || "Only founders and co-founders can do this.");

  return (
    <div className="live-hub space-y-6 rounded-2xl p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="live-kicker">Live control center</p>
          <h2 className="live-serif text-3xl">{rooms.length} on air · {recs.length} replays</h2>
        </div>
        <Link to="/live" className="live-primary">Open Live page / Go live</Link>
      </div>

      <section className={box}>
        <h3 className="mb-3 font-semibold">Live sessions</h3>
        {rooms.length === 0 && <p className="live-meta text-sm">Nothing is live right now.</p>}
        {rooms.map((r) => (
          <div key={r.id} className="mb-3 rounded-xl border border-white/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <b>{r.title}</b>
                <p className="live-meta text-xs">{r.mode} · {r.visibility}{r.access_key ? ` · key ${r.access_key}` : ""} · host {r.host_name} · started {new Date(r.started_at).toLocaleTimeString()}{r.is_recording ? " · recording" : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ShareRoom room={r} withKey />
                <Link to={`/live?room=${r.id}`} className="live-secondary">Join</Link>
                <button className="live-secondary" onClick={() => confirm("End this session for everyone?") && end({ data: { userId: user?.id || "", roomId: r.id } }).catch(fail)}>End for all</button>
              </div>
            </div>
            <p className="live-meta mt-2 text-xs">
              Online now ({(people[r.id] || []).length}): {(people[r.id] || []).map((p) => p.name || p.identity).join(", ") || "—"}
            </p>
          </div>
        ))}
      </section>

      <section className={box}>
        <h3 className="mb-3 font-semibold">Recordings</h3>
        {recs.length === 0 && <p className="live-meta text-sm">No recordings yet.</p>}
        {recs.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
            <span>{r.title} <span className="live-meta text-xs">· {new Date(r.created_at).toLocaleString()}</span></span>
            <button className="live-secondary" onClick={() => confirm("Hide this replay from the site?") && hide({ data: { userId: user?.id || "", recordingId: r.id } }).catch(fail)}>Hide</button>
          </div>
        ))}
      </section>

      <section className={box}>
        <h3 className="mb-3 font-semibold">Activity log (live)</h3>
        <div className="max-h-96 overflow-y-auto text-sm">
          {log.map((a) => (
            <div key={a.id} className="flex gap-3 border-b border-white/5 py-1.5">
              <span className="live-meta w-36 shrink-0 text-xs">{new Date(a.created_at).toLocaleString()}</span>
              <span><b>{a.actor_name || "Visitor"}</b> <span className="live-meta">{a.action.replace(/_/g, " ")}</span> {a.target}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

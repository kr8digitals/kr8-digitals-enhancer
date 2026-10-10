import { useEffect, useState } from "react";
import { Link, useLocation } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";

// Site-wide "on air" banner driven by the single live_rooms system.
export default function SiteLiveBanner() {
  const { pathname } = useLocation();
  const [rooms, setRooms] = useState([]);
  const [dismissed, setDismissed] = useState("");

  useEffect(() => {
    const load = () =>
      supabase.from("live_rooms").select("id,title,host_name,mode,visibility").eq("is_live", true)
        .order("started_at", { ascending: false }).then(({ data }) => setRooms(data || []));
    load();
    const ch = supabase.channel("site-live-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const room = rooms[0];
  if (!room || pathname.startsWith("/live") || dismissed === room.id) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-[#ED3AAE]/40 bg-[#19111F] px-4 py-2 text-[#F8F2F8]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 text-xs sm:text-sm">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ED3AAE] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ED3AAE]" />
        </span>
        <span className="shrink-0 font-bold uppercase tracking-wider text-[#ED3AAE]">Live now</span>
        <span className="min-w-0 flex-1 truncate">
          <b>{room.title}</b><span className="hidden text-[#978A9C] sm:inline"> · {room.host_name}{rooms.length > 1 ? ` · +${rooms.length - 1} more` : ""}</span>
        </span>
        <Link to={`/live?room=${room.id}`} className="shrink-0 rounded-full bg-[#ED3AAE] px-3 py-1 font-bold text-[#0B0710]">
          {room.visibility === "private" ? "Join (invite)" : "Join"}
        </Link>
        <button onClick={() => setDismissed(room.id)} aria-label="Dismiss" className="shrink-0 px-1 text-[#978A9C] hover:text-[#F8F2F8]">✕</button>
      </div>
    </div>
  );
}

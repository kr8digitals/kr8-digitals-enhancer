// @ts-nocheck
import { getSupabase } from "./supabase";

/** Record a user activity in the shared activity log (fire-and-forget). */
export function logActivity(action: string, opts: { actorId?: string; actorName?: string; target?: string; details?: Record<string, unknown> } = {}) {
  const supabase = getSupabase();
  if (!supabase) return;
  let actorId = opts.actorId, actorName = opts.actorName;
  if (!actorId && typeof window !== "undefined") {
    try {
      const cur = JSON.parse(localStorage.getItem("kr8_current") || "null");
      actorId = cur?.id; actorName = actorName || cur?.name;
    } catch { /* ignore */ }
  }
  supabase.from("activity_log").insert({
    actor_id: actorId || null,
    actor_name: actorName || null,
    action: action.slice(0, 80),
    target: opts.target || null,
    details: opts.details || {},
    path: typeof window !== "undefined" ? window.location.pathname : null,
  }).then(() => {}, () => {});
}

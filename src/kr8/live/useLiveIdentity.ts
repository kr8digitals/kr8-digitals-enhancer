// @ts-nocheck
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useServerFn } from "@tanstack/react-start";
import { checkHost } from "@/lib/live.functions";
import { supabase } from "@/integrations/supabase/client";

export function useLiveIdentity() {
  const { user } = useAuth();
  const [guest, setGuest] = useState<{ id: string; name: string } | null>(null);
  const [isHost, setIsHost] = useState(false);
  const check = useServerFn(checkHost);

  useEffect(() => {
    try {
      let id = localStorage.getItem("kr8_guest_id");
      if (!id) {
        id = "guest_" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("kr8_guest_id", id);
      }
      setGuest({ id, name: localStorage.getItem("kr8_guest_name") || "" });
    } catch {
      setGuest({ id: "guest_" + Date.now(), name: "" });
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return setIsHost(false);
    check({ data: { userId: user.id } }).then((r) => setIsHost(r.isHost)).catch(() => setIsHost(false));
  }, [user?.id]);

  const id = user?.id || guest?.id || "";
  const name = user?.name || guest?.name || "";
  const setGuestName = (n: string) => {
    try { localStorage.setItem("kr8_guest_name", n); } catch {}
    setGuest((g) => (g ? { ...g, name: n } : g));
  };
  return { id, name, signedIn: !!user, isHost, setGuestName };
}

export async function signedFileUrl(path: string) {
  const { data } = await supabase.storage.from("live-files").createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
}

export function fmtDuration(s?: number | null) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${s % 60}s`;
}

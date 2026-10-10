import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { moderateMessage } from "@/lib/live.functions";
import { signedFileUrl } from "./useLiveIdentity";
import { logActivity } from "../lib/activityLog";

const QUICK = ["👍", "❤️", "😂", "🔥", "👏", "🎉"];

function Attachment({ m }) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (m.attachment_path) signedFileUrl(m.attachment_path).then(setUrl); }, [m.attachment_path]);
  if (!m.attachment_path) return null;
  if ((m.attachment_type || "").startsWith("image/") && url)
    return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.attachment_name} className="mt-1 max-h-48 rounded-lg" /></a>;
  return (
    <a href={url || "#"} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5 text-xs text-pink-200 underline">
      📎 {m.attachment_name}
    </a>
  );
}

export default function RoomChat({ roomId, me, isHost }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [typing, setTyping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const endRef = useRef(null);
  const chanRef = useRef(null);
  const lastTyping = useRef(0);
  const moderate = useServerFn(moderateMessage);

  useEffect(() => {
    let alive = true;
    supabase.from("room_messages").select("*").eq("room_id", roomId).order("created_at").limit(500)
      .then(({ data }) => alive && setMsgs(data || []));
    const ch = supabase
      .channel(`room-chat-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, (p) => {
        setMsgs((cur) => {
          const row = p.new;
          const i = cur.findIndex((x) => x.id === row.id);
          if (i === -1) return [...cur, row];
          const next = cur.slice(); next[i] = row; return next;
        });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.id === me.id) return;
        setTyping((t) => ({ ...t, [payload.id]: { name: payload.name, at: Date.now() } }));
      })
      .subscribe();
    chanRef.current = ch;
    const iv = setInterval(() => setTyping((t) => Object.fromEntries(Object.entries(t).filter(([, v]) => Date.now() - v.at < 3500))), 1500);
    return () => { alive = false; clearInterval(iv); supabase.removeChannel(ch); };
  }, [roomId, me.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  // read receipts: mark the latest messages as read by me
  useEffect(() => {
    const unread = msgs.filter((m) => m.sender_id !== me.id && !(m.read_by || []).includes(me.id)).slice(-20);
    unread.forEach((m) => {
      supabase.from("room_messages").update({ read_by: [...(m.read_by || []), me.id].slice(-200) }).eq("id", m.id).then(() => {});
    });
  }, [msgs.length, me.id]);

  const byId = useMemo(() => Object.fromEntries(msgs.map((m) => [m.id, m])), [msgs]);
  const pinned = msgs.filter((m) => m.is_pinned && !m.is_deleted).slice(-1)[0];

  const send = async (extra = {}) => {
    const body = text.trim();
    if (!body && !extra.attachment_path) return;
    setText("");
    const r = replyTo; setReplyTo(null);
    await supabase.from("room_messages").insert({
      room_id: roomId, sender_id: me.id, sender_name: me.name, text: body || null, reply_to: r?.id || null, ...extra,
    });
    logActivity("live_message", { target: roomId });
  };

  const onType = (v) => {
    setText(v);
    if (Date.now() - lastTyping.current > 1500) {
      lastTyping.current = Date.now();
      chanRef.current?.send({ type: "broadcast", event: "typing", payload: { id: me.id, name: me.name } });
    }
  };

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return alert("Files must be under 25 MB");
    setUploading(true);
    const path = `chat/${roomId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("live-files").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return alert("Upload failed, please try again");
    send({ attachment_path: path, attachment_name: file.name, attachment_type: file.type });
  };

  const react = async (m, emoji) => {
    setPickerFor(null);
    const r = { ...(m.reactions || {}) };
    const list = new Set(r[emoji] || []);
    list.has(me.id) ? list.delete(me.id) : list.add(me.id);
    r[emoji] = [...list];
    if (!r[emoji].length) delete r[emoji];
    await supabase.from("room_messages").update({ reactions: r }).eq("id", m.id);
  };

  const typers = Object.values(typing).map((t) => t.name);

  return (
    <div className="flex h-full flex-col">
      {pinned && (
        <div className="border-b border-white/10 bg-pink-500/10 px-3 py-2 text-xs text-pink-100">
          📌 <b>{pinned.sender_name}:</b> {pinned.text || pinned.attachment_name}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 && <p className="mt-8 text-center text-xs text-[#8e82a8]">No messages yet. Say hello 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === me.id;
          const parent = m.reply_to ? byId[m.reply_to] : null;
          const reads = (m.read_by || []).length;
          return (
            <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-sm bg-gradient-to-br from-pink-600 to-purple-700 text-white" : "rounded-bl-sm bg-white/10 text-white"}`}>
                {!mine && <div className="text-[11px] font-bold text-pink-300">{m.sender_name || "Guest"}</div>}
                {parent && (
                  <div className="mb-1 border-l-2 border-pink-300 pl-2 text-[11px] opacity-80">
                    <b>{parent.sender_name}</b>: {(parent.is_deleted ? "Message deleted" : parent.text || parent.attachment_name || "").slice(0, 80)}
                  </div>
                )}
                {m.is_deleted ? (
                  <i className="opacity-60">Message deleted</i>
                ) : (
                  <>
                    {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                    <Attachment m={m} />
                  </>
                )}
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine && <span title={`Seen by ${reads}`}>{reads > 0 ? "✓✓" : "✓"}</span>}
                </div>
                {Object.keys(m.reactions || {}).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(m.reactions).map(([e, ids]) => (
                      <button key={e} onClick={() => react(m, e)} className={`rounded-full px-1.5 text-xs ${ids.includes(me.id) ? "bg-white/30" : "bg-black/30"}`}>
                        {e} {ids.length}
                      </button>
                    ))}
                  </div>
                )}
                {!m.is_deleted && (
                  <div className={`absolute -top-3 ${mine ? "left-0" : "right-0"} hidden gap-1 rounded-full bg-[#1d0b2e] px-1.5 py-0.5 text-xs shadow group-hover:flex`}>
                    <button onClick={() => setReplyTo(m)} title="Reply">↩</button>
                    <button onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)} title="React">☺</button>
                    {isHost && <button onClick={() => moderate({ data: { userId: me.id, messageId: m.id, action: m.is_pinned ? "unpin" : "pin" } })} title="Pin">📌</button>}
                    {isHost && <button onClick={() => moderate({ data: { userId: me.id, messageId: m.id, action: "delete" } })} title="Delete">🗑</button>}
                  </div>
                )}
                {pickerFor === m.id && (
                  <div className="absolute -bottom-8 z-10 flex gap-1 rounded-full bg-[#1d0b2e] px-2 py-1 shadow-lg">
                    {QUICK.map((e) => <button key={e} onClick={() => react(m, e)}>{e}</button>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="h-4 px-3 text-[11px] italic text-[#8e82a8]">
        {typers.length > 0 && `${typers.slice(0, 2).join(", ")} ${typers.length > 1 ? "are" : "is"} typing…`}
      </div>
      {replyTo && (
        <div className="mx-3 flex items-center justify-between rounded-t-lg bg-white/5 px-2 py-1 text-[11px] text-[#cabfe0]">
          <span>Replying to <b>{replyTo.sender_name}</b>: {(replyTo.text || replyTo.attachment_name || "").slice(0, 50)}</span>
          <button onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-white/10 p-2">
        <label className="cursor-pointer rounded-full p-2 text-lg hover:bg-white/10" title="Attach file">
          {uploading ? "⏳" : "📎"}
          <input type="file" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <input
          value={text}
          onChange={(e) => onType(e.target.value)}
          placeholder="Message"
          maxLength={4000}
          className="flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-pink-400 focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-pink-600 px-4 py-2 text-sm font-bold text-white hover:bg-pink-500">Send</button>
      </form>
    </div>
  );
}

import { useState } from "react";

export function roomLink(room, withKey = false) {
  const base = `${typeof location !== "undefined" ? location.origin : ""}/live?room=${room.id}`;
  return withKey && room.access_key ? `${base}&key=${room.access_key}` : base;
}

export default function ShareRoom({ room, withKey = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = roomLink(room, withKey);
  const text = `Join "${room.title}" live on KR8 Digitals`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copy this link", link); }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const native = async () => {
    if (navigator.share) { try { await navigator.share({ title: room.title, text, url: link }); return; } catch {} }
    setOpen((o) => !o);
  };
  const enc = encodeURIComponent;
  const targets = [
    ["WhatsApp", `https://wa.me/?text=${enc(`${text}: ${link}`)}`],
    ["Telegram", `https://t.me/share/url?url=${enc(link)}&text=${enc(text)}`],
    ["X", `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(link)}`],
    ["Email", `mailto:?subject=${enc(text)}&body=${enc(`${text}\n\n${link}`)}`],
  ];
  return (
    <div className={`relative inline-flex gap-2 ${className}`}>
      <button type="button" onClick={copy} className="live-secondary">{copied ? "Link copied ✓" : "Copy link"}</button>
      <button type="button" onClick={native} className="live-secondary" aria-expanded={open}>Share</button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#19111F] p-3 shadow-2xl">
          <p className="mb-2 break-all text-[11px] text-[#978A9C]">{link}</p>
          {withKey && room.access_key && <p className="mb-2 text-[11px] text-[#F8F2F8]">This link includes the invite key.</p>}
          <div className="grid grid-cols-2 gap-2">
            {targets.map(([n, href]) => (
              <a key={n} href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-white/5 px-2 py-1.5 text-center text-xs text-[#F8F2F8] hover:bg-white/10">{n}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

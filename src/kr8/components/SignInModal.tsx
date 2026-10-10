// Simplified SignInModal - Supabase only, no legacy auth
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "../router-shim";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "reset";
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  if (!isOpen) return null;
  const { user } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#170a2a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <img src="/branding/kr8_logo.png" alt="KR8 Logo" className="h-10 w-10 rounded-xl object-contain" />
            <div><span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">KR8 Digitals Portal</span><h3 className="font-display text-2xl font-bold text-white">Secure Sign-In</h3></div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">✕</button>
        </div>

        <div className="mt-5 space-y-4 text-center">
          <p className="text-sm text-[#cabfe0]">Sign-in uses Supabase Auth - works on any device. KR8 ID or email + password, Google, or biometrics.</p>
          {user ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">Signed in as <span className="font-bold text-white">{user.name}</span> ({user.kr8_id})</div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Link to="/signin" onClick={onClose} className="w-full rounded-xl bg-gradient-pink py-3 text-sm font-bold text-white">Go to Secure Sign-In Page →</Link>
            <Link to="/register" onClick={onClose} className="w-full rounded-xl border border-white/15 py-3 text-sm font-bold text-white">Create Account →</Link>
          </div>
          <p className="text-[11px] text-[#8a7ba8]">No localStorage accounts. Founder role only after email verification. Phone alone never grants admin.</p>
        </div>
      </div>
    </div>
  );
}

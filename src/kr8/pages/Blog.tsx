import { useMemo, useState, useEffect } from "react";
import { Link } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { Pill, GradientButton, GhostButton } from "../components/ui";
import Icon from "../components/Icon";
import { useSeo } from "../lib/useSeo";
import { supabase } from "@/integrations/supabase/client";

type BlogPost = {
  id: string;
  title: string;
  excerpt?: string;
  content?: string;
  category: string;
  author: string;
  author_id?: string;
  author_avatar?: string;
  img?: string;
  cover_image_url?: string;
  video_url?: string;
  media_type?: string;
  pinned?: boolean;
  published?: boolean;
  source?: string;
  likes?: number;
  liked_by?: string[];
  read_time?: string;
  created_at: string;
};

const cats = ["All", "Digital Skills", "AI", "Community", "Announcements", "Company News", "Creative Showcase"];

function safeArray<T>(v: any, fallback: T[] = []): T[] {
  return Array.isArray(v) ? v : fallback;
}

export default function Blog() {
  useSeo({
    title: "Blog & Insights — Stories from Africa's Creative Revolution | KR8 Digitals",
    description: "Real stories, case studies, and tactical insights from 3,000+ African creators who went from zero to paid. Learn free, build for real, get discovered.",
    path: "/blog",
  });
  const { student, currentUser } = useAuth() as any;
  const user = student || currentUser;
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [targetCreator, setTargetCreator] = useState("");
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);

  const [storyTitle, setStoryTitle] = useState("");
  const [storyCategory, setStoryCategory] = useState("Community");
  const [storyMediaType, setStoryMediaType] = useState<"text" | "image" | "video">("image");
  const [storyMediaUrl, setStoryMediaUrl] = useState("");
  const [storyExcerpt, setStoryExcerpt] = useState("");
  const [storyContent, setStoryContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [commentName, setCommentName] = useState(user?.name || "");
  const [commentText, setCommentText] = useState("");

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('blog_posts')
        .select('id,title,excerpt,content,category,author,author_id,cover_image_url,video_url,published,pinned,created_at')
        .eq('published', true)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) throw err;
      const mapped = safeArray(data).map((p: any) => ({
        id: p.id,
        title: p.title,
        excerpt: p.excerpt || "",
        content: p.content || "",
        category: p.category || "Community",
        author: p.author || "KR8 Team",
        author_id: p.author_id,
        img: p.cover_image_url,
        cover_image_url: p.cover_image_url,
        video_url: p.video_url,
        media_type: p.video_url ? "video" : p.cover_image_url ? "image" : "text",
        pinned: !!p.pinned,
        published: !!p.published,
        created_at: p.created_at,
        read_time: "4 min",
        likes: 0,
      }));
      // Fallback to curated posts if DB empty
      if (mapped.length === 0) {
        setAllPosts([
          {
            id: "welcome",
            title: "Welcome to the KR8 Community Blog — Where Proof Beats Paper",
            excerpt: "We built KR8 to kill gatekeeping. Free cohorts, verifiable IDs, real client work. Here's how 3,000+ African creators went from zero to paid.",
            content: "KR8 Digitals was forged to democratize elite digital skills. No tuition, no gatekeeping, just proof. Every week, students ship daily drills, earn XP, climb the leaderboard, and step into paid agency work. This blog is where we document the journey — unfiltered.",
            category: "Community",
            author: "Timfire",
            img: "/branding/kr8_logo.png",
            pinned: true,
            published: true,
            created_at: new Date().toISOString(),
            read_time: "3 min",
          },
          {
            id: "academy",
            title: "How Our Free Academy Produces Studio-Ready Designers in 8 Weeks",
            excerpt: "Portfolio-first, feedback-heavy, zero theory fluff. The exact system behind our Graphic, Web, and Video tracks.",
            content: "Week-by-week, live drills, real tutors, verifiable certificates. We don't teach tools, we engineer craft that bills.",
            category: "Digital Skills",
            author: "KR8 Academy",
            img: "https://images.pexels.com/photos/3184296/pexels-photo-3184296.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
            pinned: false,
            published: true,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            read_time: "5 min",
          },
          {
            id: "agency",
            title: "From Free Student to Paid Retainer: The Agency Pipeline",
            excerpt: "How top graduates team up with senior directors to engineer brand, web, and video for global clients.",
            content: "We don't just teach — we hire. Top 5% of each cohort enters agency shadowing, then paid retainers. Real briefs, real revenue.",
            category: "Creative Showcase",
            author: "KR8 Agency",
            img: "https://images.pexels.com/photos/4348298/pexels-photo-4348298.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
            pinned: false,
            published: true,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            read_time: "4 min",
          },
        ]);
      } else {
        setAllPosts(mapped);
      }
    } catch (e: any) {
      setError(e.message);
      setAllPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const { data } = await supabase.from('blog_comments').select('id,content,author_id,created_at').eq('post_id', postId).order('created_at', { ascending: true }).limit(50);
      setComments(safeArray(data));
    } catch {
      setComments([]);
    }
  };

  useEffect(() => {
    loadPosts();
    const params = new URLSearchParams(window.location.search);
    const storyId = params.get("post");
    if (storyId) setOpen(storyId);
  }, []);

  useEffect(() => {
    if (open) loadComments(open);
  }, [open]);

  useEffect(() => {
    if (user?.name) setCommentName(user.name);
  }, [user]);

  const ordered = useMemo(() => {
    const safe = safeArray(allPosts);
    const pinned = safe.filter((b) => b.pinned);
    const rest = safe.filter((b) => !b.pinned);
    return [...pinned, ...rest];
  }, [allPosts]);

  const posts = useMemo(() => {
    const safe = safeArray(ordered);
    return cat === "All" ? safe : safe.filter((b) => b.category === cat);
  }, [ordered, cat]);

  const active = useMemo(() => safeArray(allPosts).find((b) => b.id === open) || null, [allPosts, open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Image max 10MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const name = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { data, error } = await supabase.storage.from('site-media').upload(name, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('site-media').getPublicUrl(data.path);
      setStoryMediaUrl(pub.publicUrl);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setWriteModalOpen(false);
      setTargetCreator("Creators");
      setAuthPromptOpen(true);
      return;
    }
    if (!storyTitle.trim() || !storyContent.trim()) {
      alert("Title and content required");
      return;
    }
    try {
      const { error } = await supabase.from('blog_posts').insert({
        title: storyTitle.trim(),
        excerpt: storyExcerpt.trim() || storyContent.slice(0, 150) + "...",
        content: storyContent.trim(),
        category: storyCategory,
        author: user.name || "KR8 Creator",
        author_id: user.id || null,
        cover_image_url: storyMediaType === "image" ? storyMediaUrl : null,
        video_url: storyMediaType === "video" ? storyMediaUrl : null,
        published: true,
        pinned: false,
      });
      if (error) throw error;
      setWriteModalOpen(false);
      setStoryTitle("");
      setStoryExcerpt("");
      setStoryContent("");
      setStoryMediaUrl("");
      loadPosts();
    } catch (err: any) {
      alert("Publish failed: " + err.message);
    }
  };

  const handleShare = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/blog?post=${postId}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 3000);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !commentText.trim()) return;
    try {
      const { error } = await supabase.from('blog_comments').insert({
        post_id: active.id,
        content: commentText.trim(),
        author_id: user?.id || null,
      });
      if (error) throw error;
      setCommentText("");
      loadComments(active.id);
    } catch (err: any) {
      alert("Comment failed: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="section-bg min-h-screen py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="h-32 rounded-3xl border border-white/10 bg-white/[0.03] animate-pulse" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="h-64 rounded-3xl border border-white/10 bg-white/[0.03] animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="section-bg min-h-screen py-14">
        <div className="mx-auto max-w-4xl px-5">
          <button onClick={() => setOpen(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-pink-400 hover:text-pink-300">← Back to insights</button>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <span className="rounded-full bg-pink-500/15 border border-pink-500/30 px-3 py-1 text-xs font-bold text-pink-400">{active.category}</span>
            {active.pinned && <span className="rounded-full bg-gradient-pink px-2.5 py-0.5 text-xs font-bold text-white">Featured</span>}
          </div>
          <h1 className="font-display mt-4 text-3xl sm:text-5xl leading-tight text-white font-black">{active.title}</h1>
          <p className="mt-3 text-sm text-[#b8aecf]">{active.author} · {new Date(active.created_at).toLocaleDateString()} · {active.read_time}</p>
          {active.img && <div className="mt-8 aspect-video w-full rounded-3xl overflow-hidden bg-black/50 border border-white/10"><img src={active.img} alt={active.title} className="h-full w-full object-cover" /></div>}
          {active.video_url && <div className="mt-8 aspect-video w-full rounded-3xl overflow-hidden bg-black border border-white/10"><video src={active.video_url} controls className="h-full w-full object-cover" /></div>}
          <div className="mt-8 rounded-3xl border border-white/5 bg-black/20 p-6 sm:p-8 space-y-5 text-[#d8cde8] text-base leading-relaxed whitespace-pre-line">
            <p className="font-semibold text-lg text-white">{active.excerpt}</p>
            <div>{active.content}</div>
          </div>
          <div className="mt-8 flex gap-2">
            <button onClick={(e) => handleShare(e, active.id)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white">Share → {copiedPostId === active.id ? "Copied!" : ""}</button>
          </div>
          <div className="mt-10">
            <h3 className="text-lg font-bold text-white mb-4">Discussion ({comments.length})</h3>
            <form onSubmit={handleAddComment} className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3 mb-6">
              {!user && <input required placeholder="Your name" value={commentName} onChange={e => setCommentName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white" />}
              <textarea required rows={3} placeholder="Share your perspective..." value={commentText} onChange={e => setCommentText(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white" />
              <div className="flex justify-end"><button type="submit" className="rounded-xl bg-gradient-pink px-4 py-2 text-xs font-bold text-white">Post Comment</button></div>
            </form>
            <div className="space-y-3">
              {comments.map((c: any) => (
                <div key={c.id} className="rounded-2xl border border-white/5 bg-black/30 p-4">
                  <p className="text-xs text-[#d8cde8]">{c.content}</p>
                  <p className="text-[10px] text-[#7d6f96] mt-1">{new Date(c.created_at).toLocaleString()}</p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-center py-6 text-xs text-[#8a7ba8]">No comments yet. Be first.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-bg min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <Pill>Insights from the Frontlines</Pill>
            <h1 className="font-display mt-4 text-4xl sm:text-6xl text-white font-black">Stories, Systems & <span className="text-gradient">Proof.</span></h1>
            <p className="mt-3 max-w-2xl text-sm text-[#b8aecf] leading-relaxed">No fluff. Just real breakdowns from 3,000+ creators who went from zero to paid — design systems, web architecture, video engines, and agency playbooks that actually bill.</p>
          </div>
          <div className="shrink-0 flex gap-2">
            <button onClick={() => user ? setWriteModalOpen(true) : setAuthPromptOpen(true)} className="rounded-2xl bg-gradient-pink px-5 py-3 text-xs font-bold text-white shadow-xl">Write a Story →</button>
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error} <button onClick={loadPosts} className="ml-2 underline">Retry</button></div>}

        <div className="mt-8 flex flex-wrap gap-2">
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${cat === c ? "bg-gradient-pink text-white shadow-md" : "border border-white/15 text-[#b8aecf] hover:border-white/30"}`}>{c}</button>
          ))}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map(b => (
            <div key={b.id} className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] hover:border-pink-500/40 transition-all">
              <div onClick={() => setOpen(b.id)} className="relative aspect-video overflow-hidden bg-black/40 cursor-pointer">
                {b.video_url ? <video src={b.video_url} className="h-full w-full object-cover" /> : b.img ? <img src={b.img} alt={b.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-900/30 to-purple-900/30"><Icon name="book" size={32} className="text-pink-400/60" /></div>}
                <span className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-bold text-pink-300 border border-white/10">{b.category}</span>
                {b.pinned && <span className="absolute top-3 right-3 rounded-full bg-gradient-pink px-2.5 py-0.5 text-[10px] font-bold text-white">Featured</span>}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="text-[11px] text-[#8a7ba8]">{b.author} · {new Date(b.created_at).toLocaleDateString()}</p>
                <h3 onClick={() => setOpen(b.id)} className="mt-2 cursor-pointer font-bold text-white text-base leading-snug group-hover:text-pink-300 line-clamp-2">{b.title}</h3>
                <p onClick={() => setOpen(b.id)} className="mt-2 cursor-pointer line-clamp-2 text-xs text-[#b8aecf]">{b.excerpt}</p>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <button onClick={() => setOpen(b.id)} className="text-xs font-bold text-pink-400 hover:text-pink-300">Read story →</button>
                  <button onClick={(e) => handleShare(e, b.id)} className="text-[#8a7ba8] hover:text-white"><Icon name="share" size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {posts.length === 0 && <div className="mt-16 text-center py-12 rounded-3xl border border-white/10 bg-black/20"><p className="text-sm text-[#8a7ba8]">No stories in "{cat}" yet. Be first to ship.</p></div>}
      </div>

      {writeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-[#160d2b] p-6 my-8">
            <div className="flex justify-between border-b border-white/10 pb-3"><h4 className="font-bold text-white">Write a Story</h4><button onClick={() => setWriteModalOpen(false)} className="h-7 w-7 rounded-full bg-white/10 text-white">✕</button></div>
            <form onSubmit={handlePublishStory} className="mt-4 space-y-4">
              <input required placeholder="Title" value={storyTitle} onChange={e => setStoryTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={storyCategory} onChange={e => setStoryCategory(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white">{cats.filter(c=>c!=="All").map(c=><option key={c} value={c}>{c}</option>)}</select>
                <select value={storyMediaType} onChange={e => setStoryMediaType(e.target.value as any)} className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white"><option value="image">Image</option><option value="video">Video</option><option value="text">Text</option></select>
              </div>
              {storyMediaType !== "text" && (
                <div className="space-y-2">
                  <input type="file" accept={storyMediaType==="image"?"image/*":"video/*"} onChange={handleUpload} className="w-full text-xs text-[#8a7ba8] file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white" />
                  <input placeholder="Or paste URL" value={storyMediaUrl} onChange={e => setStoryMediaUrl(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white" />
                  {uploading && <p className="text-[11px] text-pink-300">Uploading to Storage...</p>}
                </div>
              )}
              <input placeholder="Excerpt (hook)" value={storyExcerpt} onChange={e => setStoryExcerpt(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white" />
              <textarea required rows={6} placeholder="Your story..." value={storyContent} onChange={e => setStoryContent(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white" />
              <div className="flex justify-end gap-2 pt-3 border-t border-white/10"><button type="button" onClick={()=>setWriteModalOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-[#b8aecf]">Cancel</button><button type="submit" className="rounded-xl bg-gradient-pink px-5 py-2 text-xs font-bold text-white">Publish →</button></div>
            </form>
          </div>
        </div>
      )}

      {authPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-pink-500/30 bg-[#160d2b] p-6 text-center">
            <h3 className="text-xl font-bold text-white">Join to publish</h3>
            <p className="mt-2 text-xs text-[#b8aecf]">Create free account to share stories, follow creators, and master high-income skills.</p>
            <div className="mt-6 space-y-2"><GradientButton to="/register" className="w-full">Create Account →</GradientButton><GhostButton to="/signin" className="w-full">Sign In</GhostButton></div>
            <button onClick={()=>setAuthPromptOpen(false)} className="mt-4 text-xs text-[#8a7ba8]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

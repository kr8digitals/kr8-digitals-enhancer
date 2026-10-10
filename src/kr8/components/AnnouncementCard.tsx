import { useState, useEffect } from "react";
import { Card } from "./ui";
import Icon from "./Icon";
import { parseVideoSource, getMediaAsset } from "../utils/mediaStorage";

export default function AnnouncementCard({
  announcement,
  className = "",
}: {
  announcement: any;
  className?: string;
}) {
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>("");
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);

  if (!announcement) return null;

  const videoUrl = announcement.videoUrl || announcement.video_url || "";
  const rawImage = announcement.image || announcement.image_url || announcement.videoPoster || "";
  const videoMeta = parseVideoSource(videoUrl);
  const isVideo = announcement.type === "video" || !!videoUrl;
  const isImage = (announcement.type === "image" || announcement.type === "flyer" || !!rawImage) && !isVideo;
  const content = announcement.body || announcement.caption || announcement.content || announcement.message || "";
  const title = announcement.title || "Announcement";
  const author = announcement.author || announcement.author_name || "KR8 Admin";
  const date = announcement.date || (announcement.created_at ? new Date(announcement.created_at).toLocaleDateString() : "");
  const speaker = announcement.speaker || "";

  useEffect(() => {
    let active = true;
    if (videoUrl) {
      if (videoUrl.startsWith("idb:")) {
        getMediaAsset(videoUrl).then((asset) => {
          if (active && asset) setResolvedVideoUrl(asset);
        });
      } else {
        setResolvedVideoUrl(videoUrl);
      }
    }
    if (rawImage) {
      if (rawImage.startsWith("idb:")) {
        getMediaAsset(rawImage).then((asset) => {
          if (active && asset) setResolvedImageUrl(asset);
        });
      } else {
        setResolvedImageUrl(rawImage);
      }
    }
    return () => {
      active = false;
    };
  }, [videoUrl, rawImage]);

  return (
    <Card className={`overflow-hidden !p-0 border border-white/10 bg-white/[0.03] transition-all hover:border-pink-500/30 flex flex-col justify-between ${className}`}>
      <div>
        {isVideo && (
          <div className="relative aspect-video w-full overflow-hidden bg-black/80">
            {videoMeta.type === "youtube" || videoMeta.type === "vimeo" ? (
              <iframe
                src={videoMeta.embedUrl}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : resolvedVideoUrl ? (
              <div className="relative h-full w-full">
                <video
                  src={resolvedVideoUrl}
                  poster={resolvedImageUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {!isPlaying && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="h-12 w-12 rounded-full bg-gradient-pink flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
                      <Icon name="video" size={24} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/60 text-xs text-[#8a7ba8]">
                <span>Loading video stream...</span>
              </div>
            )}
          </div>
        )}

        {isImage && (resolvedImageUrl || rawImage) && (
          <div className="relative aspect-video w-full overflow-hidden bg-black/40">
            <img
              src={resolvedImageUrl || rawImage}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          </div>
        )}

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400">
                {author}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-[11px] text-[#8a7ba8]">{date}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/[0.05] text-[#b8aecf] border border-white/10">
              {isVideo ? "Video Broadcast" : isImage ? "Visual Notice" : "Official Notice"}
            </span>
          </div>

          <h3 className="font-display text-lg sm:text-xl font-bold text-white leading-snug">
            {title}
          </h3>

          {content && (
            <p className="mt-3 text-xs sm:text-sm text-[#b8aecf] leading-relaxed whitespace-pre-line">
              {content}
            </p>
          )}

          {speaker && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-xs text-purple-300">
              <Icon name="user" size={16} />
              <span>Special Guest / Speaker: <strong>{speaker}</strong></span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

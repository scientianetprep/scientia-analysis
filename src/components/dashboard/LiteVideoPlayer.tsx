"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface LiteVideoPlayerProps {
  url: string;
  onEnded?: () => void;
}

export function LiteVideoPlayer({ url, onEnded }: LiteVideoPlayerProps) {
  const [isYouTube, setIsYouTube] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isHLS, setIsHLS] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Detect YouTube URL
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(ytRegex);
    
    if (match && match[1]) {
      setIsYouTube(true);
      setVideoId(match[1]);
      setLoading(false);
    } else {
      setIsYouTube(false);
      setVideoId(null);
      // Check for HLS (.m3u8)
      if (url.includes(".m3u8")) {
         setIsHLS(true);
      } else {
         setIsHLS(false);
         setLoading(false);
      }
    }
  }, [url]);

  // HLS.js Implementation
  useEffect(() => {
    if (isHLS && videoRef.current) {
       const video = videoRef.current;
       
       // Dynamic Import HLS.js to keep bundle small
       import("hls.js").then(({ default: Hls }) => {
          if (Hls.isSupported()) {
             const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
             });
             hls.loadSource(url);
             hls.attachMedia(video);
             hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false);
                video.play().catch(() => {}); // Autoplay might fail
             });
             hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                   const msg = "Failed to load secure stream.";
                   setError(msg);
                   toast.error(msg);
                }
             });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
             // Native HLS support (Safari)
             video.src = url;
             video.addEventListener("loadedmetadata", () => {
                setLoading(false);
                video.play().catch(() => {});
             });
          }
       }).catch(() => {
          const msg = "Video engine failed to initialize.";
          setError(msg);
          toast.error(msg);
       });
    }
  }, [isHLS, url]);

  // YouTube Message Listener for Completion
  useEffect(() => {
    if (isYouTube && onEnded) {
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== "https://www.youtube.com") return;
        try {
          const data = JSON.parse(event.data);
          if (data.event === "onStateChange" && data.info === 0) {
            onEnded();
          }
        } catch (_e) {}
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [isYouTube, onEnded]);

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border border-outline-variant/15 group">
      {loading && !error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm gap-2">
          <Loader2 className="w-6 h-6 text-tertiary animate-spin" />
          <p className="text-white/70 text-xs">Loading stream…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md gap-2 p-4 text-center">
          <AlertCircle className="w-6 h-6 text-brand-accent" />
          <div className="space-y-0.5">
            <p className="text-white text-sm font-poppins font-medium">{error}</p>
            <p className="text-white/50 text-xs">
              Refresh or check your internet connection.
            </p>
          </div>
        </div>
      )}

      {isYouTube && videoId ? (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&modestbranding=1&rel=0&iv_load_policy=3&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Protected Lesson Video"
        />
      ) : (
        <video
          ref={videoRef}
          src={isHLS ? undefined : url}
          className="w-full h-full object-contain"
          controls
          controlsList="nodownload noremoteplayback"
          onEnded={onEnded}
          onPlay={() => setLoading(false)}
        >
          {!isHLS && <source src={url} type="video/mp4" />}
          Your browser does not support the video tag.
        </video>
      )}

    </div>
  );
}

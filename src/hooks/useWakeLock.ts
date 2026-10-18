import { useEffect, useRef } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export default function useWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const nav = navigator as WakeLockNavigator;

    const startFallback = () => {
      if (fallbackVideoRef.current) {
        fallbackVideoRef.current.play().catch(() => {});
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 2;
        const ctx = canvas.getContext("2d");
        const stream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(1);
        if (!stream) return;
        const video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("muted", "");
        video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;";
        video.srcObject = stream;
        document.body.appendChild(video);
        fallbackVideoRef.current = video;
        const tick = () => {
          if (!fallbackVideoRef.current || !ctx) return;
          ctx.fillStyle = Date.now() % 2000 < 1000 ? "#000" : "#010101";
          ctx.fillRect(0, 0, 2, 2);
          setTimeout(tick, 1000);
        };
        tick();
        video.play().catch(() => {});
      } catch (_e) { /* fallback not supported */ }
    };

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      if (nav.wakeLock?.request) {
        try {
          const s = await nav.wakeLock.request("screen");
          if (cancelled) {
            s.release().catch(() => {});
            return;
          }
          sentinelRef.current = s;
          s.addEventListener("release", () => {
            if (!cancelled && document.visibilityState === "visible") {
              setTimeout(acquire, 500);
            }
          });
          return;
        } catch (_e) { /* use fallback */ }
      }
      startFallback();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(acquire, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
      if (fallbackVideoRef.current) {
        fallbackVideoRef.current.pause();
        fallbackVideoRef.current.srcObject = null;
        fallbackVideoRef.current.remove();
        fallbackVideoRef.current = null;
      }
    };
  }, [enabled]);
}

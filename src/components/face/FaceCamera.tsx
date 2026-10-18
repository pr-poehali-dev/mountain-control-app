import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { loadFaceApi, detectFace, cameraErrorText, type FaceResult } from "@/lib/face";
import useWakeLock from "@/hooks/useWakeLock";

export type FaceTone = "idle" | "found" | "ok" | "error";

interface Props {
  active: boolean;
  onFace: (face: FaceResult | null, video: HTMLVideoElement) => Promise<void> | void;
  tone?: FaceTone;
  hint?: string;
  interval?: number;
  withDescriptor?: boolean;
}

const toneColor: Record<FaceTone, string> = {
  idle: "border-white/50",
  found: "border-mine-amber",
  ok: "border-mine-green",
  error: "border-mine-red",
};

export default function FaceCamera({ active, onFace, tone = "idle", hint, interval = 450, withDescriptor = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onFaceRef = useRef(onFace);
  onFaceRef.current = onFace;
  const optsRef = useRef({ interval, withDescriptor });
  optsRef.current = { interval, withDescriptor };
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useWakeLock(active && phase === "ready");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setPhase("loading");
    setError("");

    const stop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const loop = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused) {
        try {
          const face = await detectFace(video, optsRef.current.withDescriptor);
          if (!cancelled) await onFaceRef.current(face, video);
        } catch (_e) { /* skip frame */ }
      } else if (video?.paused) {
        video.play().catch(() => {});
      }
      if (!cancelled) timer = setTimeout(loop, optsRef.current.interval);
    };

    (async () => {
      try {
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          }),
          loadFaceApi(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (!cancelled) setRetry((r) => r + 1);
        });
        setPhase("ready");
        loop();
      } catch (err) {
        if (cancelled) return;
        console.error("[FaceCamera]", err);
        setError(
          err instanceof Error && /models|fetch|load/i.test(err.message)
            ? "Не удалось загрузить модуль распознавания. Проверьте интернет"
            : cameraErrorText(err)
        );
        setPhase("error");
      }
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible" && streamRef.current?.getVideoTracks()[0]?.readyState === "ended") {
        setRetry((r) => r + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, [active, retry]);

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        />
        {phase === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-[48%] aspect-[3/4] rounded-[50%] border-4 transition-colors duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] ${toneColor[tone]}`}
            />
          </div>
        )}
        {phase === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Включаем камеру и распознавание...</p>
          </div>
        )}
        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <Icon name="CameraOff" size={28} className="text-mine-red" />
            <p className="text-sm text-white/90">{error}</p>
            <button
              type="button"
              onClick={() => setRetry((r) => r + 1)}
              className="text-xs px-3 py-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"
            >
              Повторить
            </button>
          </div>
        )}
      </div>
      {phase === "ready" && hint && (
        <p className="text-sm text-center text-muted-foreground min-h-[1.25rem]">{hint}</p>
      )}
    </div>
  );
}

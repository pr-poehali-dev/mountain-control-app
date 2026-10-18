import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import FaceCamera, { type FaceTone } from "./FaceCamera";
import { detectFace, loadFaceApi, snapshot, type FaceResult } from "@/lib/face";

const SAMPLES = 5;
const MIN_FACE_RATIO = 0.2;

interface Props {
  onCapture: (descriptors: number[][], photo: string) => Promise<void>;
  busy?: boolean;
  cameraLabel?: string;
  extraButtons?: React.ReactNode;
}

export default function FaceCapture({ onCapture, busy, cameraLabel = "Снять с камеры", extraButtons }: Props) {
  const [mode, setMode] = useState<"buttons" | "camera">("buttons");
  const [tone, setTone] = useState<FaceTone>("idle");
  const [hint, setHint] = useState("");
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const samplesRef = useRef<number[][]>([]);
  const photoRef = useRef("");
  const doneRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const disabled = busy || processing;

  const submit = async (descriptors: number[][], photo: string) => {
    setProcessing(true);
    setError("");
    try {
      await onCapture(descriptors, photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить фото");
    } finally {
      setProcessing(false);
      setMode("buttons");
    }
  };

  const startCamera = () => {
    samplesRef.current = [];
    photoRef.current = "";
    doneRef.current = false;
    setProgress(0);
    setTone("idle");
    setHint("Посмотрите прямо в камеру");
    setError("");
    setMode("camera");
  };

  const handleFace = async (face: FaceResult | null, video: HTMLVideoElement) => {
    if (doneRef.current) return;
    if (!face) {
      setTone("idle");
      setHint("Поместите лицо в овал");
      return;
    }
    if (face.faces > 1) {
      setTone("error");
      setHint("В кадре должен быть только один человек");
      return;
    }
    if (face.box.width / video.videoWidth < MIN_FACE_RATIO) {
      setTone("found");
      setHint("Подойдите ближе к камере");
      return;
    }
    if (face.score < 0.7) {
      setTone("found");
      setHint("Повернитесь к свету и смотрите прямо");
      return;
    }
    if (!photoRef.current) photoRef.current = snapshot(video);
    samplesRef.current.push(face.descriptor);
    const n = samplesRef.current.length;
    setProgress(Math.round((n / SAMPLES) * 100));
    setTone("found");
    setHint(n < SAMPLES ? "Отлично, слегка поверните голову..." : "Сохраняем...");
    if (n >= SAMPLES) {
      doneRef.current = true;
      setTone("ok");
      await submit(samplesRef.current, photoRef.current);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setProcessing(true);
    let url = "";
    try {
      await loadFaceApi();
      url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const face = await detectFace(img);
      if (!face) throw new Error("На фото не найдено лицо. Выберите чёткий снимок анфас");
      if (face.faces > 1) throw new Error("На фото должен быть только один человек");
      const ratio = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * ratio);
      canvas.height = Math.round(img.naturalHeight * ratio);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      await onCapture([face.descriptor], canvas.toDataURL("image/jpeg", 0.85));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обработать фото");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 rounded-md bg-mine-red/10 border border-mine-red/20 text-mine-red text-xs">{error}</div>
      )}
      {mode === "camera" ? (
        <div className="space-y-2">
          <FaceCamera active onFace={handleFace} tone={tone} hint={hint} interval={350} />
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-mine-green transition-all" style={{ width: `${progress}%` }} />
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setMode("buttons")} disabled={processing}>
            Отмена
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={startCamera} disabled={disabled}>
            <Icon name="Camera" size={14} />
            {cameraLabel}
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={disabled}>
            <Icon name={processing ? "Loader2" : "Upload"} size={14} className={processing ? "animate-spin" : ""} />
            {processing ? "Обработка..." : "Загрузить фото"}
          </Button>
          {extraButtons}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import FaceCamera, { type FaceTone } from "./FaceCamera";
import { detectFace, loadFaceApi, snapshot, type FaceResult } from "@/lib/face";

const SAMPLES = 5;
const MIN_FACE_RATIO = 0.2;

export default function FaceEnroll() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"view" | "camera">("view");
  const [tone, setTone] = useState<FaceTone>("idle");
  const [hint, setHint] = useState("");
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const samplesRef = useRef<number[][]>([]);
  const photoRef = useRef("");
  const doneRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasFace = !!user?.has_face;
  const isDemo = localStorage.getItem("mc_demo") === "true";

  const save = async (descriptors: number[][], photo: string) => {
    setSaving(true);
    setError("");
    try {
      await authApi.faceSave(descriptors, photo);
      await refreshUser();
      toast({ title: "Фото сохранено", description: "Теперь можно входить в систему по лицу" });
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить фото");
      setMode("view");
    } finally {
      setSaving(false);
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
      await save(samplesRef.current, photoRef.current);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setSaving(true);
    try {
      await loadFaceApi();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const face = await detectFace(img);
      if (!face) {
        URL.revokeObjectURL(url);
        throw new Error("На фото не найдено лицо. Выберите чёткий снимок анфас");
      }
      if (face.faces > 1) {
        URL.revokeObjectURL(url);
        throw new Error("На фото должен быть только один человек");
      }
      const ratio = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * ratio);
      canvas.height = Math.round(img.naturalHeight * ratio);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setSaving(false);
      await save([face.descriptor], canvas.toDataURL("image/jpeg", 0.85));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обработать фото");
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await authApi.faceDelete();
      await refreshUser();
      toast({ title: "Вход по лицу отключён" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-3">
        {hasFace && user?.face_photo_url ? (
          <img src={user.face_photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-mine-cyan/10 flex items-center justify-center">
            <Icon name="ScanFace" size={22} className="text-mine-cyan" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Вход по лицу</p>
          <p className={`text-xs ${hasFace ? "text-mine-green" : "text-muted-foreground"}`}>
            {hasFace ? "Фото добавлено — вход по лицу включён" : "Добавьте фото, чтобы входить через камеру"}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-2 rounded-md bg-mine-red/10 border border-mine-red/20 text-mine-red text-xs">{error}</div>
      )}

      {mode === "camera" ? (
        <div className="space-y-2">
          <FaceCamera active onFace={handleFace} tone={tone} hint={hint} interval={350} />
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-mine-green transition-all" style={{ width: `${progress}%` }} />
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setMode("view")} disabled={saving}>
            Отмена
          </Button>
        </div>
      ) : isDemo ? (
        <p className="text-xs text-muted-foreground">Недоступно в демо-режиме</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={startCamera} disabled={saving}>
            <Icon name="Camera" size={14} />
            {hasFace ? "Переснять" : "Снять с камеры"}
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={saving}>
            <Icon name="Upload" size={14} />
            {saving ? "Обработка..." : "Загрузить фото"}
          </Button>
          {hasFace && (
            <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-mine-red" onClick={remove} disabled={saving}>
              <Icon name="Trash2" size={14} />
              Удалить
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}
    </div>
  );
}

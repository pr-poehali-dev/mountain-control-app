import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { personnelApi } from "@/lib/api";

interface PhotoFieldProps {
  photoUrl?: string;
  personnelId?: number;
  userId?: number;
  disabled?: boolean;
  size?: number;
  onChange?: (url: string) => void;
  onPick?: (dataUrl: string) => void;
}

const MAX_SIDE = 800;

function resizeToDataUrl(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(resizeToDataUrl(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}

export default function PhotoField({ photoUrl = "", personnelId, userId, disabled, size = 112, onChange, onPick }: PhotoFieldProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [url, setUrl] = useState(photoUrl);
  const [busy, setBusy] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [camError, setCamError] = useState("");
  const [preview, setPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => setUrl(photoUrl), [photoUrl]);

  const save = async (dataUrl: string) => {
    if (onPick) {
      setUrl(dataUrl);
      onPick(dataUrl);
      return;
    }
    if (!personnelId && !userId) return;
    setBusy(true);
    try {
      const res = await personnelApi.uploadPhoto({ personnel_id: personnelId, user_id: userId, photo: dataUrl });
      setUrl(res.photo_url || "");
      onChange?.(res.photo_url || "");
      toast({ title: res.message || "Фото сохранено" });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Не удалось сохранить фото", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Выберите файл изображения (JPG, PNG)", variant: "destructive" });
      return;
    }
    try {
      await save(await fileToDataUrl(file));
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return;
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      handleFile(item.getAsFile());
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!camOpen) {
      stopCamera();
      return;
    }
    setCamError("");
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setCamError("Нет доступа к камере. Разрешите доступ в браузере или загрузите фото с компьютера."));
    return stopCamera;
  }, [camOpen]);

  const takeShot = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const dataUrl = resizeToDataUrl(v, v.videoWidth, v.videoHeight);
    setCamOpen(false);
    await save(dataUrl);
  };

  const remove = () => save("");

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div
        ref={zoneRef}
        tabIndex={disabled ? -1 : 0}
        onPaste={handlePaste}
        onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!disabled) handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => (url ? setPreview(true) : !disabled && fileRef.current?.click())}
        style={{ width: size, height: size * 1.25 }}
        title={disabled ? "" : "Нажмите, перетащите файл или вставьте фото (Ctrl+V)"}
        className={`relative rounded-xl overflow-hidden border-2 border-dashed cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-mine-cyan/60 transition-colors ${dragOver ? "border-mine-cyan bg-mine-cyan/10" : url ? "border-transparent" : "border-border bg-secondary/40 hover:border-mine-cyan/50"}`}
      >
        {url ? (
          <img src={url} alt="Фото" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground px-2 text-center">
            <Icon name="UserRound" size={size / 3} className="opacity-40" />
            {!disabled && <span className="text-[10px] leading-tight">Фото<br />Ctrl+V или перетащите</span>}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Icon name="Loader2" size={22} className="animate-spin text-mine-cyan" />
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="Сделать фото" onClick={() => setCamOpen(true)} disabled={busy}>
            <Icon name="Camera" size={14} />
          </Button>
          <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="Загрузить с компьютера" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="Upload" size={14} />
          </Button>
          <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="Вставить из буфера обмена" onClick={async () => {
            try {
              const items = await navigator.clipboard.read();
              for (const it of items) {
                const type = it.types.find((t) => t.startsWith("image/"));
                if (type) {
                  const blob = await it.getType(type);
                  return handleFile(new File([blob], "paste", { type }));
                }
              }
              toast({ title: "В буфере обмена нет изображения" });
            } catch {
              zoneRef.current?.focus();
              toast({ title: "Нажмите Ctrl+V, чтобы вставить фото" });
            }
          }} disabled={busy}>
            <Icon name="ClipboardPaste" size={14} />
          </Button>
          {url && (
            <Button type="button" size="icon" variant="outline" className="h-7 w-7 text-mine-red hover:text-mine-red" title="Удалить фото" onClick={remove} disabled={busy}>
              <Icon name="Trash2" size={14} />
            </Button>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />

      <Dialog open={camOpen} onOpenChange={setCamOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Camera" size={18} className="text-mine-cyan" />
              Сделать фото
            </DialogTitle>
          </DialogHeader>
          {camError ? (
            <p className="text-sm text-mine-red py-6 text-center">{camError}</p>
          ) : (
            <div className="rounded-lg overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCamOpen(false)}>Отмена</Button>
            <Button className="flex-1 gap-2 bg-mine-green text-white hover:bg-mine-green/90" onClick={takeShot} disabled={!!camError}>
              <Icon name="Aperture" size={16} />
              Снять
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="sm:max-w-xl bg-card border-border p-2">
          {url && <img src={url} alt="Фото" className="w-full max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

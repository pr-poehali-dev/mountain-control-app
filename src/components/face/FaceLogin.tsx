import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import FaceCamera, { type FaceTone } from "./FaceCamera";
import type { FaceResult } from "@/lib/face";

const MIN_FACE_RATIO = 0.18;
const STABLE_FRAMES = 2;
const ATTEMPT_PAUSE = 1500;

export default function FaceLogin() {
  const { loginByFace } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [tone, setTone] = useState<FaceTone>("idle");
  const [hint, setHint] = useState("Посмотрите прямо в камеру");
  const [failures, setFailures] = useState(0);
  const busyRef = useRef(false);
  const stableRef = useRef(0);
  const lastAttemptRef = useRef(0);

  const handleFace = async (face: FaceResult | null, video: HTMLVideoElement) => {
    if (busyRef.current) return;
    if (!face) {
      stableRef.current = 0;
      setTone("idle");
      setHint("Поместите лицо в овал");
      return;
    }
    if (face.faces > 1) {
      stableRef.current = 0;
      setTone("error");
      setHint("В кадре должен быть только один человек");
      return;
    }
    if (face.box.width / video.videoWidth < MIN_FACE_RATIO) {
      stableRef.current = 0;
      setTone("found");
      setHint("Подойдите ближе к камере");
      return;
    }
    stableRef.current += 1;
    setTone("found");
    setHint("Держите лицо неподвижно...");
    if (stableRef.current < STABLE_FRAMES) return;
    if (Date.now() - lastAttemptRef.current < ATTEMPT_PAUSE) return;

    busyRef.current = true;
    lastAttemptRef.current = Date.now();
    setHint("Проверяем...");
    try {
      await loginByFace(face.descriptor);
      setTone("ok");
      setHint("Лицо опознано, входим...");
      setTimeout(() => {
        setActive(false);
        navigate("/");
      }, 400);
    } catch (err) {
      const e = err as Error & { data?: { not_found?: boolean } };
      stableRef.current = 0;
      setTone("error");
      setFailures((f) => f + 1);
      setHint(
        e.data?.not_found
          ? "Лицо не опознано. Убедитесь, что фото добавлено в настройках профиля"
          : e.message || "Ошибка входа"
      );
      busyRef.current = false;
    }
  };

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-mine-cyan/10 flex items-center justify-center">
          <Icon name="ScanFace" size={30} className="text-mine-cyan" />
        </div>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Войдите без пароля — камера узнает вас по лицу. Фото для входа добавляется в настройках профиля.
        </p>
        <Button
          type="button"
          onClick={() => {
            setFailures(0);
            setTone("idle");
            setHint("Посмотрите прямо в камеру");
            busyRef.current = false;
            setActive(true);
          }}
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Icon name="Camera" size={16} />
          Включить камеру
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FaceCamera active={active} onFace={handleFace} tone={tone} hint={hint} />
      {failures >= 3 && (
        <p className="text-xs text-center text-muted-foreground">
          Не получается? Улучшите освещение лица или войдите по email.
        </p>
      )}
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setActive(false)}>
        <Icon name="CameraOff" size={16} />
        Выключить камеру
      </Button>
    </div>
  );
}

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import FaceCamera, { type FaceTone } from "./FaceCamera";
import { descriptorDistance, type FaceResult } from "@/lib/face";

type Challenge = "left" | "right";
type Phase = "position" | "challenge" | "verify" | "sending" | "done";

const MIN_FACE_RATIO = 0.18;
const FRONTAL_YAW = 0.07;
const TURN_DELTA = 0.13;
const CHALLENGE_TIMEOUT = 8000;
const FACE_LOST_LIMIT = 1200;
const SAME_PERSON_DISTANCE = 0.5;
const ERROR_PAUSE = 3000;

const challengeText: Record<Challenge, string> = {
  left: "Теперь поверните голову влево",
  right: "Поверните голову вправо",
};

const challengeIcon: Record<Challenge, string> = {
  left: "ArrowLeft",
  right: "ArrowRight",
};

function pickChallenges(): Challenge[] {
  return ["right", "left"];
}

export default function FaceLogin() {
  const { loginByFace } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("position");
  const [tone, setTone] = useState<FaceTone>("idle");
  const [hint, setHint] = useState("Посмотрите прямо в камеру");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [step, setStep] = useState(0);
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState("");
  const pauseUntilRef = useRef(0);

  const phaseRef = useRef<Phase>("position");
  const stableRef = useRef(0);
  const baseRef = useRef<{ descriptor: number[]; ear: number; yaw: number } | null>(null);
  const challengesRef = useRef<Challenge[]>([]);
  const stepRef = useRef(0);
  const stepStartRef = useRef(0);
  const lastSeenRef = useRef(0);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const reset = (message?: string, isError = false) => {
    stableRef.current = 0;
    baseRef.current = null;
    stepRef.current = 0;
    setStep(0);
    setChallenges([]);
    setPhaseBoth("position");
    setTone(isError ? "error" : "idle");
    if (isError && message) {
      setError(message);
      pauseUntilRef.current = Date.now() + ERROR_PAUSE;
      setHint("Повторная попытка через несколько секунд...");
    } else {
      setHint(message || "Посмотрите прямо в камеру");
    }
  };

  const start = () => {
    setFailures(0);
    setError("");
    pauseUntilRef.current = 0;
    reset();
    setActive(true);
  };

  const startChallenge = (index: number) => {
    stepRef.current = index;
    setStep(index);
    stepStartRef.current = Date.now();
    setTone("found");
    setHint(challengeText[challengesRef.current[index]]);
  };

  const challengePassed = (face: FaceResult): boolean => {
    const base = baseRef.current;
    if (!base) return false;
    const ch = challengesRef.current[stepRef.current];
    if (ch === "left") return face.yaw - base.yaw > TURN_DELTA;
    return base.yaw - face.yaw > TURN_DELTA;
  };

  const sendLogin = async (descriptor: number[]) => {
    setPhaseBoth("sending");
    setHint("Проверяем...");
    try {
      await loginByFace(descriptor);
      setPhaseBoth("done");
      setError("");
      setTone("ok");
      setHint("Лицо опознано, входим...");
      setTimeout(() => {
        setActive(false);
        navigate("/");
      }, 400);
    } catch (err) {
      const e = err as Error;
      setFailures((f) => f + 1);
      reset(e.message || "Ошибка входа. Попробуйте ещё раз", true);
    }
  };

  const handleFace = async (face: FaceResult | null, video: HTMLVideoElement) => {
    const p = phaseRef.current;
    if (p === "sending" || p === "done") return;
    const now = Date.now();
    if (now < pauseUntilRef.current) return;

    if (!face || face.faces > 1) {
      if (p === "position") {
        stableRef.current = 0;
        setTone(face ? "error" : "idle");
        setHint(face ? "В кадре должен быть только один человек" : "Поместите лицо в овал");
        return;
      }
      if (face && face.faces > 1) {
        reset("В кадре должен быть только один человек", true);
        return;
      }
      if (now - lastSeenRef.current > FACE_LOST_LIMIT) {
        reset("Лицо пропало из кадра. Начнём заново", true);
      }
      return;
    }
    lastSeenRef.current = now;

    if (p === "position") {
      if (face.box.width / video.videoWidth < MIN_FACE_RATIO) {
        stableRef.current = 0;
        setTone("found");
        setHint("Подойдите ближе к камере");
        return;
      }
      if (Math.abs(face.yaw) > FRONTAL_YAW) {
        stableRef.current = 0;
        setTone("found");
        setHint("Смотрите прямо в камеру");
        return;
      }
      stableRef.current += 1;
      setTone("found");
      setHint("Держите лицо неподвижно...");
      if (stableRef.current < 2 || face.descriptor.length !== 128) return;
      baseRef.current = { descriptor: face.descriptor, ear: face.ear, yaw: face.yaw };
      const list = pickChallenges();
      challengesRef.current = list;
      setChallenges(list);
      setPhaseBoth("challenge");
      startChallenge(0);
      return;
    }

    if (p === "challenge") {
      if (now - stepStartRef.current > CHALLENGE_TIMEOUT) {
        setFailures((f) => f + 1);
        reset("Время вышло. Попробуйте ещё раз", true);
        return;
      }
      if (!challengePassed(face)) return;
      const next = stepRef.current + 1;
      if (next < challengesRef.current.length) {
        startChallenge(next);
        return;
      }
      stepRef.current = next;
      setStep(next);
      setPhaseBoth("verify");
      stepStartRef.current = now;
      setTone("ok");
      setHint("Отлично! Теперь снова посмотрите прямо в камеру");
      return;
    }

    if (p === "verify") {
      if (now - stepStartRef.current > CHALLENGE_TIMEOUT) {
        reset("Время вышло. Попробуйте ещё раз", true);
        return;
      }
      if (Math.abs(face.yaw) > FRONTAL_YAW || face.descriptor.length !== 128) return;
      const base = baseRef.current;
      if (!base || descriptorDistance(base.descriptor, face.descriptor) > SAME_PERSON_DISTANCE) {
        reset("Проверка не пройдена. Начнём заново", true);
        return;
      }
      await sendLogin(face.descriptor);
    }
  };

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-mine-cyan/10 flex items-center justify-center">
          <Icon name="ScanFace" size={30} className="text-mine-cyan" />
        </div>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Войдите без пароля — камера узнает вас по лицу. Система попросит повернуть голову вправо, а затем влево, чтобы убедиться, что перед камерой живой человек.
        </p>
        <Button
          type="button"
          onClick={start}
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Icon name="Camera" size={16} />
          Включить камеру
        </Button>
      </div>
    );
  }

  const fastMode = phase === "challenge";

  return (
    <div className="space-y-3">
      <FaceCamera
        active={active}
        onFace={handleFace}
        tone={tone}
        hint={hint}
        interval={fastMode ? 60 : 300}
        withDescriptor={!fastMode}
      />

      {challenges.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          {challenges.map((ch, i) => {
            const done = i < step;
            const current = i === step && phase === "challenge";
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  done
                    ? "bg-mine-green/15 border-mine-green/30 text-mine-green"
                    : current
                    ? "bg-mine-amber/15 border-mine-amber/40 text-mine-amber animate-pulse"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Icon name={done ? "Check" : challengeIcon[ch]} size={12} />
                {ch === "left" ? "Влево" : "Вправо"}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-mine-red/30 bg-mine-red/10 px-3 py-2 text-sm text-mine-red">
          <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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

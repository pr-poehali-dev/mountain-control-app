import { useEffect, useRef, useState, useId } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  onScan: (code: string) => void;
  active: boolean;
  onToggle: (active: boolean) => void;
}

const isMobile = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function QrScanner({ onScan, active, onToggle }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const lastScanRef = useRef("");
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const uniqueId = useId().replace(/:/g, "");
  const readerId = `qr-reader-${uniqueId}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      safeStop();
    };
  }, []);

  const safeStop = async () => {
    try {
      if (
        scannerRef.current &&
        scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING
      ) {
        await scannerRef.current.stop();
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (active) {
      startScanner();
    } else {
      safeStop();
    }
    return () => {
      safeStop();
    };
  }, [active, cameraIndex]);

  const startScanner = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setError("");

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const el = document.getElementById(readerId);
    if (!el || !mountedRef.current) {
      startingRef.current = false;
      return;
    }

    try {
      await safeStop();

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId);
      }

      const containerWidth = el.clientWidth || 280;
      const boxSize = Math.min(Math.floor(containerWidth * 0.8), 350);

      const scanConfig = {
        fps: 20,
        qrbox: { width: boxSize, height: boxSize },
        aspectRatio: 1,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      } as Parameters<typeof scannerRef.current.start>[1];

      const onSuccess = (decodedText: string) => {
        if (decodedText !== lastScanRef.current) {
          lastScanRef.current = decodedText;
          onScan(decodedText);
          setTimeout(() => {
            lastScanRef.current = "";
          }, 2000);
        }
      };

      const onFailure = () => {};

      if (isMobile()) {
        await startWithFacingMode(scanConfig, onSuccess, onFailure);
      } else {
        await startWithDeviceList(scanConfig, onSuccess, onFailure);
      }

      applyFocusHint(el);
    } catch (err) {
      if (!mountedRef.current) {
        startingRef.current = false;
        return;
      }
      handleStartError(err);
    } finally {
      startingRef.current = false;
    }
  };

  const startWithFacingMode = async (
    scanConfig: Parameters<Html5Qrcode["start"]>[1],
    onSuccess: (text: string) => void,
    onFailure: () => void
  ) => {
    if (!scannerRef.current) return;
    await scannerRef.current.start(
      { facingMode: "environment" },
      scanConfig,
      onSuccess,
      onFailure
    );

    try {
      const devices = await Html5Qrcode.getCameras();
      if (mountedRef.current && devices.length > 1) {
        setCameras(devices.map((d) => ({ id: d.id, label: d.label })));
        const backIdx = devices.findIndex(
          (c) =>
            c.label.toLowerCase().includes("back") ||
            c.label.toLowerCase().includes("задн") ||
            c.label.toLowerCase().includes("rear") ||
            c.label.toLowerCase().includes("environment")
        );
        if (backIdx >= 0) setCameraIndex(backIdx);
      }
    } catch {
      // can't enumerate — that's fine, already scanning
    }
  };

  const startWithDeviceList = async (
    scanConfig: Parameters<Html5Qrcode["start"]>[1],
    onSuccess: (text: string) => void,
    onFailure: () => void
  ) => {
    if (!scannerRef.current) return;

    let devices: { id: string; label: string }[] = [];
    try {
      const cams = await Html5Qrcode.getCameras();
      devices = cams.map((d) => ({ id: d.id, label: d.label }));
      if (mountedRef.current) setCameras(devices);
    } catch {
      // fallback to facingMode
    }

    if (devices.length > 0) {
      const idx = cameraIndex < devices.length ? cameraIndex : 0;
      if (mountedRef.current) setCameraIndex(idx);
      await scannerRef.current.start(
        devices[idx].id,
        scanConfig,
        onSuccess,
        onFailure
      );
    } else {
      await scannerRef.current.start(
        { facingMode: "environment" },
        scanConfig,
        onSuccess,
        onFailure
      );
    }
  };

  const applyFocusHint = (el: HTMLElement) => {
    try {
      const videoEl = el.querySelector("video");
      if (videoEl && videoEl.srcObject) {
        const track = (videoEl.srcObject as MediaStream).getVideoTracks()[0];
        if (track) {
          const caps = track.getCapabilities?.() as Record<string, unknown> | undefined;
          const focusModes = (caps?.focusMode ?? []) as string[];
          const constraints: Record<string, unknown> = {};
          if (focusModes.includes("continuous")) {
            constraints.focusMode = "continuous";
          }
          if (caps?.zoom) {
            constraints.zoom = 1;
          }
          if (Object.keys(constraints).length > 0) {
            track.applyConstraints({ advanced: [constraints] } as MediaTrackConstraints);
          }
        }
      }
    } catch {
      // focus constraints not supported
    }
  };

  const handleStartError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("Permission") || msg.includes("NotAllowed")) {
      setError("Разрешите доступ к камере в настройках браузера");
    } else if (msg.includes("NotFound") || msg.includes("not found") || msg.includes("Requested device not found")) {
      setError("Камера не найдена на устройстве");
    } else if (msg.includes("NotReadableError") || msg.includes("Could not start")) {
      setError("Камера занята другим приложением. Закройте другие приложения и попробуйте снова");
    } else if (msg.includes("OverconstrainedError")) {
      setError("Камера не поддерживает нужные параметры");
    } else {
      setError("Ошибка камеры: " + msg.slice(0, 100));
    }
    onToggle(false);
  };

  const handleToggle = () => {
    if (active) {
      safeStop();
      onToggle(false);
    } else {
      onToggle(true);
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    await safeStop();
    setCameraIndex((prev) => (prev + 1) % cameras.length);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
          <Icon name="Camera" size={20} className="text-mine-cyan" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Сканирование QR-кода
          </h3>
          <p className="text-xs text-muted-foreground">
            {cameras.length > 1
              ? `Камера ${cameraIndex + 1} из ${cameras.length}`
              : "Наведите на QR-код"}
          </p>
        </div>
      </div>

      <div
        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
          active
            ? "border-mine-cyan bg-black"
            : "border-dashed border-border bg-secondary/30"
        }`}
      >
        <div
          id={readerId}
          className={active ? "w-full" : "hidden"}
          style={{ minHeight: active ? 300 : 0 }}
        />

        {!active && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon
              name="Camera"
              size={48}
              className="text-muted-foreground/30"
            />
            <p className="text-sm text-muted-foreground">
              Камера не активна
            </p>
          </div>
        )}

        {active && (
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none z-10">
            <div className="px-2 py-1 rounded bg-black/60 text-mine-cyan text-[10px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mine-green animate-pulse" />
              Сканирование...
            </div>
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="pointer-events-auto p-2 rounded-lg bg-black/60 hover:bg-black/80 transition-colors"
              >
                <Icon name="SwitchCamera" size={18} className="text-white" />
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-mine-red/10 border border-mine-red/20 text-mine-red text-xs flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <Button
        onClick={handleToggle}
        className={`w-full gap-2 ${
          active
            ? "bg-mine-red hover:bg-mine-red/90 text-white"
            : "bg-mine-cyan hover:bg-mine-cyan/90 text-white"
        }`}
      >
        <Icon name={active ? "CameraOff" : "Camera"} size={16} />
        {active ? "Остановить" : "Включить камеру"}
      </Button>
    </div>
  );
}

import { useEffect, useRef, useState, useId, useCallback } from "react";
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
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
      destroyScanner();
    };
  }, []);

  const destroyScanner = async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      }
    } catch (_e) { /* cleanup */ }
    scannerRef.current = null;
  };

  const safeStop = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          await scannerRef.current.stop();
        }
      }
    } catch (_e) { /* ignore */ }
  }, []);

   
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

    await new Promise<void>((r) => setTimeout(r, 80));
    await new Promise<void>((r) =>
      requestAnimationFrame(() => r())
    );

    const el = document.getElementById(readerId);
    if (!el || !mountedRef.current) {
      startingRef.current = false;
      return;
    }

    try {
      await destroyScanner();

      scannerRef.current = new Html5Qrcode(readerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });

      const containerWidth = el.clientWidth || 280;
      const boxSize = Math.min(Math.floor(containerWidth * 0.8), 350);

      const scanConfig = {
        fps: 30,
        qrbox: { width: boxSize, height: boxSize },
        disableFlip: false,
        videoConstraints: {
          facingMode: isMobile() ? "environment" : "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
        await startMobile(scanConfig, onSuccess, onFailure);
      } else {
        await startDesktop(scanConfig, onSuccess, onFailure);
      }

      if (mountedRef.current) {
        applyFocusHint(el);
      }
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

  const startMobile = async (
    config: Parameters<Html5Qrcode["start"]>[1],
    onOk: (text: string) => void,
    onFail: () => void
  ) => {
    if (!scannerRef.current) return;

    await scannerRef.current.start(
      { facingMode: "environment" },
      config,
      onOk,
      onFail
    );

    try {
      const devices = await Html5Qrcode.getCameras();
      if (mountedRef.current && devices.length > 1) {
        setCameras(devices.map((d) => ({ id: d.id, label: d.label })));
      }
    } catch (_e) { /* no enumeration */ }
  };

  const startDesktop = async (
    config: Parameters<Html5Qrcode["start"]>[1],
    onOk: (text: string) => void,
    onFail: () => void
  ) => {
    if (!scannerRef.current) return;

    let devices: { id: string; label: string }[] = [];
    try {
      const cams = await Html5Qrcode.getCameras();
      devices = cams.map((d) => ({ id: d.id, label: d.label }));
      if (mountedRef.current) setCameras(devices);
    } catch (_e) { /* fallback */ }

    if (devices.length > 0) {
      const idx = cameraIndex < devices.length ? cameraIndex : 0;
      await scannerRef.current.start(
        devices[idx].id,
        config,
        onOk,
        onFail
      );
    } else {
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        onOk,
        onFail
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
            track.applyConstraints({
              advanced: [constraints],
            } as MediaTrackConstraints);
          }
        }
      }
    } catch (_e) { /* focus not supported */ }
  };

  const handleStartError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[QrScanner] Camera error:", msg);

    if (msg.includes("Permission") || msg.includes("NotAllowed")) {
      setError("Разрешите доступ к камере в настройках браузера");
    } else if (
      msg.includes("NotFound") ||
      msg.includes("not found") ||
      msg.includes("Requested device not found")
    ) {
      setError("Камера не найдена на устройстве");
    } else if (msg.includes("NotReadableError") || msg.includes("Could not start")) {
      setError(
        "Камера занята другим приложением. Закройте другие приложения и попробуйте снова"
      );
    } else if (msg.includes("OverconstrainedError")) {
      setError("Камера не поддерживает нужные параметры");
    } else {
      setError("Ошибка камеры: " + msg.slice(0, 120));
    }
  };

  const handleToggle = () => {
    if (active) {
      safeStop();
      onToggle(false);
    } else {
      setError("");
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
        <div className="ml-auto flex items-center gap-2">
          {cameras.length > 1 && active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={switchCamera}
              className="gap-1 text-xs"
            >
              <Icon name="RefreshCw" size={14} />
              Камера
            </Button>
          )}
          <Button
            type="button"
            variant={active ? "destructive" : "default"}
            size="sm"
            onClick={handleToggle}
            className="gap-1 text-xs"
          >
            <Icon name={active ? "CameraOff" : "Camera"} size={14} />
            {active ? "Стоп" : "Старт"}
          </Button>
        </div>
      </div>

      <div
        id={readerId}
        className="w-full rounded-lg overflow-hidden bg-black/5 dark:bg-white/5"
        style={{
          minHeight: active ? 300 : 120,
          display: active ? "block" : "none",
        }}
      />

      {!active && !error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-mine-cyan/10 flex items-center justify-center">
            <Icon name="ScanLine" size={28} className="text-mine-cyan" />
          </div>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            Нажмите &laquo;Старт&raquo; для включения камеры
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Icon name="AlertTriangle" size={22} className="text-destructive" />
          </div>
          <p className="text-sm text-destructive max-w-[260px]">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setError("");
              onToggle(true);
            }}
            className="gap-1"
          >
            <Icon name="RotateCcw" size={14} />
            Повторить
          </Button>
        </div>
      )}
    </div>
  );
}
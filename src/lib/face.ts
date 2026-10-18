import type * as FaceApi from "@vladmandic/face-api";

let faceapiPromise: Promise<typeof FaceApi> | null = null;

export function loadFaceApi(): Promise<typeof FaceApi> {
  if (!faceapiPromise) {
    faceapiPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      return faceapi;
    })().catch((e) => {
      faceapiPromise = null;
      throw e;
    });
  }
  return faceapiPromise;
}

export interface FaceResult {
  descriptor: number[];
  score: number;
  box: { x: number; y: number; width: number; height: number };
  faces: number;
}

export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceResult | null> {
  const faceapi = await loadFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  const results = await faceapi
    .detectAllFaces(input, options)
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (!results.length) return null;
  const best = results.reduce((a, b) => (a.detection.box.area > b.detection.box.area ? a : b));
  const b = best.detection.box;
  return {
    descriptor: Array.from(best.descriptor),
    score: best.detection.score,
    box: { x: b.x, y: b.y, width: b.width, height: b.height },
    faces: results.length,
  };
}

export function snapshot(video: HTMLVideoElement, maxSize = 640): string {
  const ratio = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * ratio);
  canvas.height = Math.round(video.videoHeight * ratio);
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function cameraErrorText(err: unknown): string {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (/NotAllowed|Permission/i.test(msg)) return "Разрешите доступ к камере в настройках браузера";
  if (/NotFound|not found/i.test(msg)) return "Камера не найдена на устройстве";
  if (/NotReadable|Could not start/i.test(msg)) return "Камера занята другим приложением";
  if (!window.isSecureContext) return "Камера доступна только по защищённому адресу (https)";
  return "Не удалось включить камеру";
}

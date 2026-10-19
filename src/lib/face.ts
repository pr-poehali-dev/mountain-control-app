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

export function preloadFaceApi() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  loadFaceApi()
    .then(async (faceapi) => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      await faceapi
        .detectAllFaces(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 128 }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    })
    .catch(() => {});
}

export interface FaceResult {
  descriptor: number[];
  score: number;
  box: { x: number; y: number; width: number; height: number };
  faces: number;
  ear: number;
  yaw: number;
}

type Pt = { x: number; y: number };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function eyeRatio(p: Pt[]): number {
  return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2 * dist(p[0], p[3]) || 1);
}

function faceMetrics(points: Pt[]): { ear: number; yaw: number } {
  const ear = (eyeRatio(points.slice(36, 42)) + eyeRatio(points.slice(42, 48))) / 2;
  const left = points[0];
  const right = points[16];
  const nose = points[30];
  const width = right.x - left.x || 1;
  const yaw = (nose.x - left.x) / width - 0.5;
  return { ear, yaw };
}

export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  withDescriptor = true
): Promise<FaceResult | null> {
  const faceapi = await loadFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: withDescriptor ? 416 : 320,
    scoreThreshold: 0.5,
  });
  const base = faceapi.detectAllFaces(input, options).withFaceLandmarks();
  const results = withDescriptor ? await base.withFaceDescriptors() : await base;
  if (!results.length) return null;
  const best = results.reduce((a, b) => (a.detection.box.area > b.detection.box.area ? a : b));
  const b = best.detection.box;
  const desc = (best as { descriptor?: Float32Array }).descriptor;
  return {
    descriptor: desc ? Array.from(desc) : [],
    score: best.detection.score,
    box: { x: b.x, y: b.y, width: b.width, height: b.height },
    faces: results.length,
    ...faceMetrics(best.landmarks.positions),
  };
}

export function descriptorDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
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

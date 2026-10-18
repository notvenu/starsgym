"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";

const SIZE = 720; // saved photos are 720×720 JPEGs (~80–150 KB)
const MP = "1.0.1"; // keep in step with @mediapipe/tasks-vision in package.json

// Loaded on first use only (~10 MB of wasm from the CDN), then reused.
let detector: Promise<FaceDetector | null> | undefined;
function getDetector() {
  detector ??= (async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/wasm`);
      return await FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.6,
      });
    } catch {
      return null;
    }
  })();
  return detector;
}

/** null = good to go, otherwise what to fix. The face must be clear, alone, close enough, centred and lit. */
async function checkFace(canvas: HTMLCanvasElement): Promise<string | null> {
  const fd = await getDetector();
  // ponytail: if the detector can't load (offline, old browser) the photo is accepted — staff still see it on every scan
  if (!fd) return null;
  const faces = fd.detect(canvas).detections.filter((d) => (d.categories[0]?.score ?? 0) >= 0.6 && d.boundingBox);
  if (faces.length === 0) return "We can't see a face. Face the camera in good light, with nothing covering your face.";
  if (faces.length > 1) return "Only you in the photo, please.";
  const { originX: x, originY: y, width: w, height: h } = faces[0].boundingBox!;
  if ((w * h) / (SIZE * SIZE) < 0.07) return "Move closer — your face should fill most of the circle.";
  if (Math.abs(x + w / 2 - SIZE / 2) > SIZE * 0.18 || Math.abs(y + h / 2 - SIZE / 2) > SIZE * 0.2) return "Centre your face in the circle.";
  const px = canvas.getContext("2d")!.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, Math.min(w, SIZE - x)), Math.max(1, Math.min(h, SIZE - y))).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 16) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  const light = sum / (px.length / 16);
  if (light < 55) return "Too dark — find better light and try again.";
  if (light > 235) return "Too bright — step out of direct light.";
  return null;
}

/**
 * Take a selfie or upload a photo. Checks the face, crops a square, and puts the JPEG in a hidden
 * <input type="file" name="photo"> so the surrounding form submits it like any other field.
 */
export function PhotoCapture({ current, label = "Photo", required }: { current?: string | null; label?: string; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  };
  useEffect(() => stop, []);

  async function openCamera() {
    setError("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      setCamera(true);
      void getDetector(); // warm up while they pose
      requestAnimationFrame(() => {
        if (video.current && stream.current) video.current.srcObject = stream.current;
      });
    } catch {
      setError("Couldn't open the camera. Allow camera access, or upload a photo instead.");
    }
  }

  async function accept(source: CanvasImageSource, w: number, h: number) {
    setBusy(true);
    setError("");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const side = Math.min(w, h);
    canvas.getContext("2d")!.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
    const problem = await checkFace(canvas);
    if (problem) {
      setBusy(false);
      return setError(problem);
    }
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob || !input.current) return setError("Couldn't process that photo — try another.");
        const dt = new DataTransfer();
        dt.items.add(new File([blob], "photo.jpg", { type: "image/jpeg" }));
        input.current.files = dt.files;
        input.current.dispatchEvent(new Event("change", { bubbles: true })); // clears a "Add a photo" message
        setPreview((old) => (old && URL.revokeObjectURL(old), URL.createObjectURL(blob)));
        stop();
      },
      "image/jpeg",
      0.86,
    );
  }

  const capture = () => {
    const v = video.current;
    if (v?.videoWidth) void accept(v, v.videoWidth, v.videoHeight);
  };

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      await accept(bmp, bmp.width, bmp.height);
      bmp.close();
    } catch {
      setError("That file isn't a photo we can read. Try a JPG or PNG.");
    }
  }

  const shown = preview ?? current;
  return (
    <div data-field className="flex flex-col gap-3">
      <span className="label">{label}</span>
      <input ref={input} type="file" name="photo" accept="image/jpeg" className="hidden" tabIndex={-1} aria-hidden="true" required={required && !current} />

      {camera ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative size-[min(16rem,68vw)] overflow-hidden rounded-full border-4 border-red bg-black sm:size-72">
            <video ref={video} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
            {/* face guide */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-[16%_22%] rounded-[50%] border-2 border-dashed border-white/70" />
          </div>
          <p className="text-center text-sm text-ash">Face inside the oval, good light, no cap or sunglasses.</p>
          <div className="flex gap-2">
            <button type="button" onClick={capture} disabled={busy} className="btn-red">{busy ? "Checking…" : "Capture"}</button>
            <button type="button" onClick={stop} className="btn-ghost">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${preview ? "border-red" : "border-strong"} bg-panel`}>
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="Member photo" className="size-full object-cover" />
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-faint" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <button type="button" onClick={openCamera} disabled={busy} className="btn-red min-h-11 px-5 text-sm">{shown ? "Retake" : "Take photo"}</button>
            <label className="btn-ghost min-h-11 cursor-pointer px-5 text-sm">
              {busy ? "Checking…" : "Upload"}
              <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>
      )}
      {preview && !error && <p role="status" className="text-sm text-ash">Looks good — your face is clear.</p>}
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";

const SIZE = 720; // saved photos are 720×720 JPEGs (~80–150 KB)
const MP = "1.1.1"; // must match @mediapipe/tasks-vision in package.json exactly (JS and wasm from different versions break)

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

/** Start downloading the face checker (~13 MB the first time, then from the browser cache) without blocking anything. */
export function warmUpFaceCheck() {
  if (typeof window === "undefined" || detector) return;
  const go = () => void getDetector();
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}

// The face check works on a small copy: the detector shrinks its input to 128 px anyway, and handing it 720×720 cost
// a visible freeze on older phones. Boxes are scaled back to the full photo.
const CHECK = 256;
// A desk with slow internet doesn't wait for the checker to download: past this the photo is taken as it is.
const WAIT_MS = 3500;

/** null = good to go, otherwise what to fix. The face must be clear, alone, close enough, centred and lit. */
async function checkFace(canvas: HTMLCanvasElement): Promise<string | null> {
  // ponytail: if the detector can't load in time (slow network, offline, old browser) the photo is accepted — staff
  // still see it on every scan. It keeps loading in the background for the next photo.
  const fd = await Promise.race([getDetector(), new Promise<null>((r) => setTimeout(() => r(null), WAIT_MS))]);
  if (!fd) return null;
  const small = document.createElement("canvas");
  small.width = small.height = CHECK;
  small.getContext("2d")!.drawImage(canvas, 0, 0, CHECK, CHECK);
  let found;
  try {
    found = fd.detect(small).detections;
  } catch {
    return null; // the detector broke on this device: accept the photo, like when it can't load
  }
  const faces = found.filter((d) => (d.categories[0]?.score ?? 0) >= 0.6 && d.boundingBox);
  if (faces.length === 0) return "We can't see a face. Face the camera in good light, with nothing covering your face.";
  if (faces.length > 1) return "Only you in the photo, please.";
  const k = SIZE / CHECK;
  const b = faces[0].boundingBox!;
  const [x, y, w, h] = [b.originX * k, b.originY * k, b.width * k, b.height * k].map(Math.round);
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
 * Take a photo (front or back camera) or upload one. Checks the face, crops a square, and puts the JPEG in a hidden
 * <input type="file" name="photo"> so the surrounding form submits it like any other field.
 * `back`: open the back camera first — staff photographing a member at the desk.
 */
export function PhotoCapture({ current, label = "Photo", required, back }: { current?: string | null; label?: string; required?: boolean; back?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">(back ? "environment" : "user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  };
  useEffect(() => stop, []);
  // a required photo (new member) will be taken for sure: fetch the face checker while the desk types the details
  useEffect(() => {
    if (required && !current) warmUpFaceCheck();
  }, [required, current]);

  async function openCamera(side = facing) {
    setError("");
    stream.current?.getTracks().forEach((t) => t.stop()); // switching cameras: let go of the other one first
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: side, width: { ideal: 960 }, height: { ideal: 960 } }, audio: false });
      setFacing(side);
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
    if (v?.videoWidth) accept(v, v.videoWidth, v.videoHeight).catch(() => (setBusy(false), setError("Couldn't take that photo — try again.")));
  };

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      setBusy(true);
      // decode a 12 MP phone photo straight to ~1000 px instead of full size (much less memory and time)
      const full = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.min(full.width, full.height));
      const bmp = scale < 1 ? await createImageBitmap(full, { resizeWidth: Math.round(full.width * scale), resizeHeight: Math.round(full.height * scale), resizeQuality: "medium" }) : full;
      if (bmp !== full) full.close();
      await accept(bmp, bmp.width, bmp.height);
      bmp.close();
    } catch {
      setBusy(false);
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
            {/* the front camera is mirrored like a mirror; the back camera shows the scene as it is */}
            <video ref={video} autoPlay playsInline muted className={`size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
            {/* face guide */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-[16%_22%] rounded-[50%] border-2 border-dashed border-white/70" />
          </div>
          <p className="text-center text-sm text-ash">Face inside the oval, good light, no cap or sunglasses.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={capture} disabled={busy} className="btn-red">{busy ? "Checking…" : "Capture"}</button>
            <button type="button" onClick={() => void openCamera(facing === "user" ? "environment" : "user")} disabled={busy} className="btn-ghost">
              {facing === "user" ? "Back camera" : "Front camera"}
            </button>
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
            <button type="button" onClick={() => void openCamera()} disabled={busy} className="btn-red min-h-11 px-5 text-sm">{shown ? "Retake" : "Take photo"}</button>
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

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Zap, ZapOff } from "lucide-react";
import {
  getCameraStream,
  getTorchStream,
  stopCameraStream,
  getTorchInfo,
  getTorchState,
  setTorch,
  captureSquareImage,
  CAMERA_ERRORS,
} from "@/lib/camera";

export default function Camera({ onCapture, onBack, title = "الكاميرا" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const capturingRef = useRef(false);

  const [status, setStatus] = useState("starting"); // starting | ready | capturing | error
  const [errorKey, setErrorKey] = useState("");
  const [torch, setTorchInfo2] = useState({
    supported: false,
    states: [],
    current: "off",
  });
  const [flashFeedback, setFlashFeedback] = useState(false);
  const [torchError, setTorchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream = null;

    async function start() {
      try {
        stream = await getCameraStream();
        if (cancelled) {
          stopCameraStream(stream);
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        const track = stream.getVideoTracks()[0];
        const info = getTorchInfo(track);
        const settingsTorch = getTorchState(track);
        setTorchInfo2({
          supported: info.supported,
          states: info.states,
          current: settingsTorch === true ? "on" : "off",
        });
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorKey(
          err.message === "unsupported"
            ? "unsupported"
            : err.message === "permission"
              ? "permission"
              : "unavailable",
        );
        setStatus("error");
      }
    }

    start();

    return () => {
      cancelled = true;
      stopCameraStream(stream);
      streamRef.current = null;
    };
  }, []);

  async function applyTorch(target) {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (track && (await setTorch(track, target ? "on" : "off"))) {
      return true;
    }
    if (!track) return false;
    // Some devices only honor the flash when it is requested while the camera
    // stream is being acquired — re-open a fresh stream with the torch flag
    // baked into the constraints and swap it into the video element.
    try {
      const next = await getTorchStream(target);
      stopCameraStream(streamRef.current);
      streamRef.current = next;
      const video = videoRef.current;
      if (video) {
        video.srcObject = next;
        await video.play();
      }
      return true;
    } catch {
      return false;
    }
  }

  function handleTorchToggle() {
    const next = torch.current === "on" ? "off" : "on";
    // Flip the UI state immediately so the button never appears stuck, then
    // apply the constraint best-effort and sync back to the real camera state.
    setTorchInfo2((prev) => ({ ...prev, current: next }));
    setTorchError(false);
    void (async () => {
      const ok = await applyTorch(next === "on");
      const track = streamRef.current?.getVideoTracks?.()[0];
      const actual = track ? getTorchState(track) : null;
      if (actual !== null) {
        setTorchInfo2((prev) => ({ ...prev, current: actual ? "on" : "off" }));
      } else if (ok) {
        setTorchInfo2((prev) => ({ ...prev, current: next }));
      } else {
        // The device refused to turn the light on — put the button back and
        // tell the user the flash really isn't available here.
        setTorchInfo2((prev) => ({ ...prev, current: prev.current === "on" ? "off" : "on" }));
        setTorchError(true);
      }
    })();
    window.setTimeout(() => setTorchError(false), 3000);
  }

  function handleCapture() {
    const video = videoRef.current;
    if (status !== "ready" || capturingRef.current || !video?.videoWidth) return;

    capturingRef.current = true;
    setStatus("capturing");
    setFlashFeedback(true);

    window.setTimeout(() => {
      try {
        const dataUrl = captureSquareImage(video, 512);
        setFlashFeedback(false);
        capturingRef.current = false;
        setStatus("ready");
        onCapture(dataUrl);
      } catch {
        capturingRef.current = false;
        setFlashFeedback(false);
        setStatus("ready");
      }
    }, 220);
  }

  const torchLabel =
    torch.current === "on" ? "إيقاف الفلاش" : "تشغيل الفلاش";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onBack}
          aria-label="رجوع"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
        >
          <ArrowRight size={24} />
        </button>

        <span className="text-sm font-medium text-white/80">{title}</span>

        <button
          type="button"
          onClick={handleTorchToggle}
          aria-label={torchLabel}
          title={torchLabel}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
            torch.current === "on"
              ? "bg-primary text-white"
              : "text-white/80 hover:bg-white/10"
          }`}
        >
          {torch.current === "on" ? <Zap size={22} /> : <ZapOff size={22} />}
        </button>
      </div>

      {torchError && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-4 py-1.5 text-xs font-medium text-ink shadow-lg">
          الفلاش غير متاح على هذا الجهاز
        </div>
      )}

      {/* Square preview */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-3 py-4">
        <div
          className={`relative aspect-square w-full max-w-[560px] overflow-hidden rounded-2xl bg-black ${
            status === "error" ? "bg-neutral-900" : ""
          }`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
          />

          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white/80">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              <span className="text-sm">بدء الكاميرا…</span>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm leading-relaxed text-white/90">
                {CAMERA_ERRORS[errorKey] || CAMERA_ERRORS.unavailable}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                >
                  إعادة المحاولة
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full border border-white/30 px-5 py-2 text-sm font-medium text-white/90"
                >
                  رجوع
                </button>
              </div>
            </div>
          )}

          {/* Capture flash feedback */}
          {flashFeedback && (
            <div className="pointer-events-none absolute inset-0 bg-white/70 transition-opacity duration-150" />
          )}
        </div>
      </div>

      {/* Capture area */}
      <div className="flex flex-col items-center gap-2 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2">
        {status === "ready" && (
          <p className="text-xs text-white/50">ركز المنتج داخل الإطار</p>
        )}
        <button
          type="button"
          onClick={handleCapture}
          disabled={status !== "ready"}
          aria-label="التقاط الصورة"
          className="group flex h-18 w-18 items-center justify-center rounded-full p-1.5 transition-transform active:scale-95 disabled:opacity-40"
        >
          <span className="flex h-full w-full items-center justify-center rounded-full border-4 border-white bg-white/10 p-3">
            <span
              className={`h-full w-full rounded-full transition-colors ${
                status === "ready" ? "bg-white" : "bg-white/40"
              }`}
            />
          </span>
        </button>
        {status === "capturing" && (
          <span className="text-xs text-white/70">التقاط…</span>
        )}
      </div>
    </div>
  );
}
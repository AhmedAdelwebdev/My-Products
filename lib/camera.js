"use client";

// Browser camera helpers. All functions are safe to call on devices without
// camera support — they throw human-readable error codes instead.

export const CAMERA_ERRORS = {
  unsupported: "جهازك أو متصفحك لا يدعم الوصول للكاميرا.",
  permission:
    "تم حظر الوصول إلى الكاميرا. اسمح بالوصول من إعدادات المتصفح ثم أعد المحاولة.",
  unavailable:
    "تعذّر تشغيل الكاميرا. تأكد من وجود كاميرا وأنها غير مستخدمة من تطبيق آخر.",
};

const VIDEO = {
  width: { ideal: 640 },
  height: { ideal: 640 },
};

export async function getCameraStream() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("unsupported");
  }

  // Prefer the back camera (torch lives there); fall back to any camera.
  // `ideal` first (not `exact`) so negotiation never waits on a hard
  // constraint, and a smaller frame starts much faster on low-end phones.
  const attempts = [
    { ...VIDEO, facingMode: { ideal: "environment" } },
    { ...VIDEO },
  ];

  let lastError = null;
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (err) {
      lastError = err;
    }
  }

  if (
    lastError?.name === "NotAllowedError" ||
    lastError?.name === "PermissionDeniedError"
  ) {
    throw new Error("permission");
  }
  throw new Error("unavailable");
}

// Re-open the camera with the torch flag baked into the request. A number of
// Android/Chrome builds only light the flash when the constraint is present
// at acquisition time, so this is the last-resort path for a stubborn torch.
export async function getTorchStream(torchOn) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("unsupported");
  }
  const attempts = [
    { ...VIDEO, facingMode: { ideal: "environment" }, torch: !!torchOn },
    { ...VIDEO, torch: !!torchOn },
  ];
  let lastError = null;
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    lastError?.name === "NotAllowedError" ? "permission" : "unavailable",
  );
}

export function stopCameraStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

// Flash / torch support detection.
//
// Browsers are inconsistent: some advertise `torch` as `true`, some as a
// dictionary like `{ min: false, max: true }`, and some never advertise it
// even though `applyConstraints` turns the light on anyway. So "supported"
// is decided optimistically — the toggle is always shown and toggles
// between on/off, and applying the constraint itself is best-effort.
export function getTorchInfo(track) {
  try {
    const capabilities = track?.getCapabilities?.();
    let torch = capabilities?.torch;
    if (torch == null) return { supported: false, states: [] };
    if (typeof torch === "boolean") {
      return { supported: torch, states: ["off", "on"] };
    }
    if (typeof torch === "object" && torch !== null) {
      const values = Array.isArray(torch) ? torch : [torch.min, torch.max];
      const canOn = values.some((v) => v === true || v === 1);
      return { supported: canOn, states: ["off", "on"] };
    }
    return { supported: true, states: ["off", "on"] };
  } catch {
    return { supported: false, states: [] };
  }
}

export function getTorchState(track) {
  try {
    const settings = track?.getSettings?.();
    return typeof settings?.torch === "boolean" ? settings.torch : null;
  } catch {
    return null;
  }
}

// Turn the torch on/off. Retries a few times and tolerates browsers that
// apply the constraint but never report a torch state in getSettings.
// `state` may be a boolean or the strings "on"/"off".
export async function setTorch(track, state) {
  if (!track) return false;
  const target = state === true || state === "on";
  const shapes = [
    { advanced: [{ torch: target }] },
    { advanced: [{ torch: target }], torch: target },
    { torch: target },
  ];

  for (const shape of shapes) {
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await track.applyConstraints(shape);
        const settings = track.getSettings?.();
        if (!settings || typeof settings.torch !== "boolean") {
          return true; // applied without throwing — trust it
        }
        if (settings.torch === target) return true;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return true;
    } catch {
      /* try the next constraint shape */
    }
  }

  // Some browsers reject direct toggling; reset then re-apply.
  try {
    await track.applyConstraints({ advanced: [{ torch: false }] });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await track.applyConstraints({ advanced: [{ torch: target }], torch: target });
    return true;
  } catch {
    return false;
  }
}

// Capture the video frame as a centered square JPEG (e.g. 512×512).
export function captureSquareImage(video, targetSize = 512) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("capture-empty");

  const size = Math.min(width, height);
  const sx = Math.floor((width - size) / 2);
  const sy = Math.floor((height - size) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, sx, sy, size, size, 0, 0, targetSize, targetSize);
  return canvas.toDataURL("image/jpeg", 0.85);
}
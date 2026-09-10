// Pure image helpers (no environment-specific code, safe for server + client).

// Extract base64 payload + content type from a data URL.
export function decodeDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return { base64: null, contentType: null };
  return { base64: match[2], contentType: match[1] };
}
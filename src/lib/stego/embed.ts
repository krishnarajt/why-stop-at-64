import { MAGIC_V1, MAGIC_V2, END_MARKER } from "./types";

/**
 * Find a byte sequence in a buffer, starting from `from`.
 */
function findSequence(
  haystack: Uint8Array,
  needle: Uint8Array,
  from: number
): number {
  for (let i = from; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

// --- Format-specific end-of-image finders ---

/** GIF trailer: last 0x3B byte */
function findGifEnd(bytes: Uint8Array): number {
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] === 0x3b) return i + 1; // include the trailer byte
  }
  return -1;
}

/** JPEG EOI marker: FF D9 (scan backwards for last occurrence) */
function findJpegEnd(bytes: Uint8Array): number {
  for (let i = bytes.length - 2; i >= 0; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return i + 2;
  }
  return -1;
}

/** PNG: find end of IEND chunk (IEND chunk = length(4) + "IEND"(4) + CRC(4) = 12 bytes after length field) */
function findPngEnd(bytes: Uint8Array): number {
  const iend = new TextEncoder().encode("IEND");
  // Search for "IEND" chunk type
  for (let i = 8; i < bytes.length - 7; i++) {
    if (
      bytes[i] === iend[0] &&
      bytes[i + 1] === iend[1] &&
      bytes[i + 2] === iend[2] &&
      bytes[i + 3] === iend[3]
    ) {
      // IEND chunk: 4 bytes type + 4 bytes CRC after type
      return i + 4 + 4; // type + CRC
    }
  }
  return -1;
}

/** WebP: RIFF container. Total file size = 8 + value at bytes[4..7] LE */
function findWebpEnd(bytes: Uint8Array): number {
  if (bytes.length < 12) return -1;
  const riffSize =
    bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  return 8 + riffSize;
}

// --- Format detection ---

export type ImageFormat = "gif" | "jpeg" | "png" | "webp";

export function detectFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < 12) return null;

  // GIF: "GIF87a" or "GIF89a"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";

  // WebP: "RIFF" + 4 bytes + "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";

  return null;
}

function findImageEnd(bytes: Uint8Array): number {
  const fmt = detectFormat(bytes);
  if (!fmt) return -1;

  switch (fmt) {
    case "gif": return findGifEnd(bytes);
    case "jpeg": return findJpegEnd(bytes);
    case "png": return findPngEnd(bytes);
    case "webp": return findWebpEnd(bytes);
  }
}

export const MIME_TYPES: Record<ImageFormat, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// --- Embed / Extract (format-agnostic) ---

/**
 * Embed a serialized payload into an image after its end-of-image marker.
 * Works with GIF, JPEG, PNG, and WebP.
 */
export function embedInImage(
  imageBytes: Uint8Array,
  payload: Uint8Array
): Uint8Array {
  const endIndex = findImageEnd(imageBytes);
  if (endIndex === -1) {
    throw new Error("Unsupported or invalid image format");
  }

  const imagePart = imageBytes.slice(0, endIndex);
  const result = new Uint8Array(
    imagePart.length + MAGIC_V2.length + payload.length + END_MARKER.length
  );
  result.set(imagePart, 0);
  result.set(MAGIC_V2, imagePart.length);
  result.set(payload, imagePart.length + MAGIC_V2.length);
  result.set(
    END_MARKER,
    imagePart.length + MAGIC_V2.length + payload.length
  );
  return result;
}

/**
 * Extract the raw payload from an image. Tries V2 first, then V1 fallback.
 * Works with any format — just searches for magic bytes.
 */
export function extractFromImage(
  imageBytes: Uint8Array
): { version: number; payload: Uint8Array } | null {
  // Try V2 first
  let magicIndex = findSequence(imageBytes, MAGIC_V2, 0);
  if (magicIndex !== -1) {
    const payloadStart = magicIndex + MAGIC_V2.length;
    const endIndex = findSequence(imageBytes, END_MARKER, payloadStart);
    if (endIndex !== -1) {
      return {
        version: 2,
        payload: imageBytes.slice(payloadStart, endIndex),
      };
    }
  }

  // V1 fallback
  magicIndex = findSequence(imageBytes, MAGIC_V1, 0);
  if (magicIndex !== -1) {
    const payloadStart = magicIndex + MAGIC_V1.length;
    const endIndex = findSequence(imageBytes, END_MARKER, payloadStart);
    if (endIndex !== -1) {
      return {
        version: 1,
        payload: imageBytes.slice(payloadStart, endIndex),
      };
    }
  }

  return null;
}

// --- Legacy aliases for backward compatibility ---

export const embedInGif = embedInImage;
export const extractFromGif = extractFromImage;

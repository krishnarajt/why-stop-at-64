import { MAGIC_V1, MAGIC_V2, END_MARKER } from "./types";
import { encrypt, decrypt } from "./encryption";

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

function findGifEnd(bytes: Uint8Array): number {
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] === 0x3b) return i + 1;
  }
  return -1;
}

function findJpegEnd(bytes: Uint8Array): number {
  for (let i = bytes.length - 2; i >= 0; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return i + 2;
  }
  return -1;
}

function findPngEnd(bytes: Uint8Array): number {
  const iend = new TextEncoder().encode("IEND");
  for (let i = 8; i < bytes.length - 7; i++) {
    if (
      bytes[i] === iend[0] &&
      bytes[i + 1] === iend[1] &&
      bytes[i + 2] === iend[2] &&
      bytes[i + 3] === iend[3]
    ) {
      return i + 4 + 4; // type + CRC
    }
  }
  return -1;
}

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
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
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

// --- Embed / Extract ---

/**
 * Embed a serialized payload into an image.
 *
 * Without password (standard mode):
 *   [IMAGE][MAGIC_V2][payload][END_MARKER]
 *
 * With password (deniable mode):
 *   [IMAGE][encrypt(MAGIC_V2 + payload + END_MARKER)]
 *   The encrypted blob is indistinguishable from random bytes.
 */
export async function embedInImage(
  imageBytes: Uint8Array,
  payload: Uint8Array,
  password?: string
): Promise<Uint8Array> {
  const endIndex = findImageEnd(imageBytes);
  if (endIndex === -1) {
    throw new Error("Unsupported or invalid image format");
  }

  const imagePart = imageBytes.slice(0, endIndex);

  if (password) {
    // Deniable mode: encrypt the entire envelope including magic and end marker
    const envelope = new Uint8Array(
      MAGIC_V2.length + payload.length + END_MARKER.length
    );
    envelope.set(MAGIC_V2, 0);
    envelope.set(payload, MAGIC_V2.length);
    envelope.set(END_MARKER, MAGIC_V2.length + payload.length);

    const encrypted = await encrypt(envelope, password);

    const result = new Uint8Array(imagePart.length + encrypted.length);
    result.set(imagePart, 0);
    result.set(encrypted, imagePart.length);
    return result;
  }

  // Standard mode: plaintext magic + payload + end marker
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

export type ExtractResult = {
  version: number; // 1 = legacy, 2 = standard V2, 3 = deniable
  payload: Uint8Array;
};

/**
 * Extract the raw payload from an image.
 *
 * Returns:
 *   version 2: found MAGIC_V2 in plaintext (standard or legacy encrypted)
 *   version 3: data after image end with no magic (deniable — needs decryption)
 *   version 1: found MAGIC_V1 (legacy)
 *   null: no payload found
 */
export function extractFromImage(
  imageBytes: Uint8Array
): ExtractResult | null {
  // Try V2 first — plaintext magic bytes
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

  // Deniable: check for data after image end marker
  const imageEnd = findImageEnd(imageBytes);
  if (imageEnd !== -1 && imageEnd < imageBytes.length) {
    const trailing = imageBytes.slice(imageEnd);
    // Must be at least salt(16) + iv(12) + some ciphertext
    if (trailing.length > 28) {
      return {
        version: 3,
        payload: trailing,
      };
    }
  }

  return null;
}

/**
 * Decrypt a deniable (version 3) payload.
 * Returns the inner serialized payload (without MAGIC_V2 and END_MARKER),
 * or null if decryption fails (wrong password or not actually deniable data).
 */
export async function decryptDeniable(
  encryptedBlob: Uint8Array,
  password: string
): Promise<Uint8Array | null> {
  try {
    const decrypted = new Uint8Array(await decrypt(encryptedBlob, password));

    // Verify decrypted content starts with MAGIC_V2
    if (decrypted.length < MAGIC_V2.length + END_MARKER.length) return null;
    for (let i = 0; i < MAGIC_V2.length; i++) {
      if (decrypted[i] !== MAGIC_V2[i]) return null;
    }

    // Strip MAGIC_V2 prefix and END_MARKER suffix
    const inner = decrypted.slice(MAGIC_V2.length);
    const endIdx = findSequence(inner, END_MARKER, 0);
    if (endIdx === -1) return null;

    return inner.slice(0, endIdx);
  } catch {
    return null; // Wrong password or corrupt data
  }
}

// Legacy aliases
export const embedInGif = embedInImage;
export const extractFromGif = extractFromImage;

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

/**
 * Find the GIF trailer byte (0x3B) scanning backwards.
 */
function findGifTrailer(gifBytes: Uint8Array): number {
  for (let i = gifBytes.length - 1; i >= 0; i--) {
    if (gifBytes[i] === 0x3b) return i;
  }
  return -1;
}

/**
 * Embed a serialized payload into a GIF after the trailer byte.
 */
export function embedInGif(
  gifBytes: Uint8Array,
  payload: Uint8Array
): Uint8Array {
  const trailerIndex = findGifTrailer(gifBytes);
  if (trailerIndex === -1) {
    throw new Error("Invalid GIF: no trailer byte found");
  }

  const gifPart = gifBytes.slice(0, trailerIndex + 1);
  const result = new Uint8Array(
    gifPart.length + MAGIC_V2.length + payload.length + END_MARKER.length
  );
  result.set(gifPart, 0);
  result.set(MAGIC_V2, gifPart.length);
  result.set(payload, gifPart.length + MAGIC_V2.length);
  result.set(
    END_MARKER,
    gifPart.length + MAGIC_V2.length + payload.length
  );
  return result;
}

/**
 * Extract the raw payload from a GIF. Tries V2 first, then V1 fallback.
 */
export function extractFromGif(
  gifBytes: Uint8Array
): { version: number; payload: Uint8Array } | null {
  // Try V2 first
  let magicIndex = findSequence(gifBytes, MAGIC_V2, 0);
  if (magicIndex !== -1) {
    const payloadStart = magicIndex + MAGIC_V2.length;
    const endIndex = findSequence(gifBytes, END_MARKER, payloadStart);
    if (endIndex !== -1) {
      return {
        version: 2,
        payload: gifBytes.slice(payloadStart, endIndex),
      };
    }
  }

  // V1 fallback
  magicIndex = findSequence(gifBytes, MAGIC_V1, 0);
  if (magicIndex !== -1) {
    const payloadStart = magicIndex + MAGIC_V1.length;
    const endIndex = findSequence(gifBytes, END_MARKER, payloadStart);
    if (endIndex !== -1) {
      return {
        version: 1,
        payload: gifBytes.slice(payloadStart, endIndex),
      };
    }
  }

  return null;
}

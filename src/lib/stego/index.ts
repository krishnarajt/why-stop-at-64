export type { StegoPayload } from "./types";

import type { StegoPayload } from "./types";
import { serializePayload, deserializePayload, deserializePayloadV1 } from "./format";
import { embedInGif, extractFromGif } from "./embed";
import { toText, fromText } from "./textcodec";

/**
 * Hide a file inside a GIF (compressed raw bytes, V2 format).
 */
export function encode(
  gifBytes: Uint8Array,
  fileBytes: Uint8Array,
  fileName: string
): Uint8Array {
  const payload = serializePayload(fileName, fileBytes);
  return embedInGif(gifBytes, payload);
}

/**
 * Extract a hidden file from a GIF. Supports V2 (compressed) and V1 (legacy base64).
 */
export function decode(gifBytes: Uint8Array): StegoPayload | null {
  const extracted = extractFromGif(gifBytes);
  if (!extracted) return null;

  if (extracted.version === 2) {
    return deserializePayload(extracted.payload);
  }

  // V1 legacy
  return deserializePayloadV1(extracted.payload);
}

/**
 * Encode a file into a copyable Unicode string (base32768).
 */
export function encodeToText(
  fileBytes: Uint8Array,
  fileName: string
): string {
  return toText(fileBytes, fileName);
}

/**
 * Decode a base32768 Unicode string back to the original file.
 */
export function decodeFromText(text: string): StegoPayload {
  return fromText(text);
}

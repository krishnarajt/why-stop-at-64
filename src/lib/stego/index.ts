export type { StegoPayload, ProgressStage, OnProgress } from "./types";

import type { StegoPayload, OnProgress } from "./types";
import {
  serializePayload,
  deserializePayload,
  deserializePayloadV1,
  isPayloadEncrypted,
} from "./format";
import { embedInGif, extractFromGif } from "./embed";
import { toText, fromText, isTextEncrypted } from "./textcodec";

/**
 * Hide a file inside a GIF (zstd-compressed raw bytes, V2 format).
 * Optionally encrypt with a password.
 */
export async function encode(
  gifBytes: Uint8Array,
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<Uint8Array> {
  const payload = await serializePayload(fileName, fileBytes, password, onProgress);
  onProgress?.("embedding");
  return embedInGif(gifBytes, payload);
}

/**
 * Check if a GIF contains an encrypted payload.
 */
export function isEncrypted(gifBytes: Uint8Array): boolean {
  const extracted = extractFromGif(gifBytes);
  if (!extracted || extracted.version !== 2) return false;
  return isPayloadEncrypted(extracted.payload);
}

/**
 * Extract a hidden file from a GIF. Supports V2 (compressed, optionally encrypted)
 * and V1 (legacy base64).
 * Throws "PASSWORD_REQUIRED" if encrypted and no password provided.
 * Throws on wrong password (AES-GCM auth failure).
 */
export async function decode(
  gifBytes: Uint8Array,
  password?: string,
  onProgress?: OnProgress
): Promise<StegoPayload | null> {
  onProgress?.("extracting");
  const extracted = extractFromGif(gifBytes);
  if (!extracted) return null;

  if (extracted.version === 2) {
    return deserializePayload(extracted.payload, password, onProgress);
  }

  // V1 legacy
  return deserializePayloadV1(extracted.payload);
}

/**
 * Encode a file into a copyable Unicode string (base32768).
 * Optionally encrypt with a password.
 */
export async function encodeToText(
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<string> {
  return toText(fileBytes, fileName, password, onProgress);
}

/**
 * Check if a base32768 string contains an encrypted payload.
 */
export function isTextEncryptedCheck(text: string): boolean {
  return isTextEncrypted(text);
}

/**
 * Decode a base32768 Unicode string back to the original file.
 * Throws "PASSWORD_REQUIRED" if encrypted and no password provided.
 */
export async function decodeFromText(
  text: string,
  password?: string,
  onProgress?: OnProgress
): Promise<StegoPayload> {
  return fromText(text, password, onProgress);
}

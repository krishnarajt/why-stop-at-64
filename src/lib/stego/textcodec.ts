import { encode as b32encode, decode as b32decode } from "base32768";
import { serializePayload, deserializePayload, isPayloadEncrypted } from "./format";
import type { StegoPayload, OnProgress } from "./types";

/**
 * Encode a file into a copyable Unicode string (base32768).
 * Uses the same compressed binary payload as the GIF embedding.
 */
export async function toText(
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<string> {
  const payload = await serializePayload(fileName, fileBytes, password, onProgress);
  onProgress?.("encoding-text");
  return b32encode(payload);
}

/**
 * Check if a base32768 string contains an encrypted payload.
 */
export function isTextEncrypted(text: string): boolean {
  const payload = b32decode(text);
  return isPayloadEncrypted(payload);
}

/**
 * Decode a base32768 Unicode string back to the original file.
 */
export async function fromText(
  text: string,
  password?: string,
  onProgress?: OnProgress
): Promise<StegoPayload> {
  const payload = b32decode(text);
  return deserializePayload(payload, password, onProgress);
}

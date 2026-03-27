import { encode as b32encode, decode as b32decode } from "base32768";
import { serializePayload, deserializePayload } from "./format";
import type { StegoPayload } from "./types";

/**
 * Encode a file into a copyable Unicode string (base32768).
 * Uses the same compressed binary payload as the GIF embedding.
 */
export function toText(fileBytes: Uint8Array, fileName: string): string {
  const payload = serializePayload(fileName, fileBytes);
  return b32encode(payload);
}

/**
 * Decode a base32768 Unicode string back to the original file.
 */
export function fromText(text: string): StegoPayload {
  const payload = b32decode(text);
  return deserializePayload(payload);
}

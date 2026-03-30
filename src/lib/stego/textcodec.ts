import { encode as b32encode, decode as b32decode } from "base32768";
import { serializePayload, deserializePayload, isPayloadEncrypted } from "./format";
import { rsEncode, rsDecode, rsSymbolCount } from "./reed-solomon";
import type { StegoPayload, OnProgress } from "./types";

/**
 * Text payload format (with RS error correction):
 * [RS_NSYM: 1 byte]              ← number of RS parity symbols per block
 * [ORIG_LEN: 4 bytes LE]         ← original payload length before RS encoding
 * [RS-encoded blocks]             ← data split into ≤223-byte blocks, each with nsym parity bytes
 */

/**
 * Encode a file into a copyable Unicode string (base32768).
 * Wraps the payload with Reed-Solomon error correction for corruption recovery.
 */
export async function toText(
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<string> {
  const payload = await serializePayload(fileName, fileBytes, password, onProgress);
  onProgress?.("encoding-text");

  const nsym = rsSymbolCount(payload.length);
  const encoded = rsEncode(payload, nsym);

  // Header: 1 byte nsym + 4 bytes original length
  const withHeader = new Uint8Array(5 + encoded.length);
  withHeader[0] = nsym;
  new DataView(withHeader.buffer).setUint32(1, payload.length, true);
  withHeader.set(encoded, 5);

  return b32encode(withHeader);
}

/**
 * Check if a base32768 string contains an encrypted payload.
 */
export function isTextEncrypted(text: string): boolean {
  const raw = b32decode(text);
  // Skip RS header (5 bytes) — flags byte is at offset 5
  if (raw.length < 6) return false;
  return isPayloadEncrypted(raw.subarray(5));
}

/**
 * Decode a base32768 Unicode string back to the original file.
 * Applies Reed-Solomon error correction, with fallback for legacy payloads.
 */
export async function fromText(
  text: string,
  password?: string,
  onProgress?: OnProgress
): Promise<StegoPayload> {
  const raw = b32decode(text);

  if (raw.length < 8) {
    throw new Error("Text payload too short");
  }

  // Try new format: [nsym:1][origLen:4][rs-encoded blocks]
  const nsym = raw[0];
  if (nsym >= 4 && nsym <= 32 && nsym % 2 === 0 && raw.length > nsym + 5) {
    const origLen = new DataView(raw.buffer, raw.byteOffset + 1, 4).getUint32(0, true);
    // Sanity check: origLen should be reasonable relative to total size
    if (origLen > 0 && origLen < raw.length) {
      try {
        const rsBlock = raw.subarray(5);
        const payload = rsDecode(rsBlock, nsym, origLen);
        return await deserializePayload(payload, password, onProgress);
      } catch (e) {
        if (e instanceof Error && e.message === "PASSWORD_REQUIRED") throw e;
        if (e instanceof Error && (e.message.includes("Too many errors") || e.message.includes("correction failed"))) {
          throw new Error(
            "Text is too corrupted to recover. Reed-Solomon correction was unable to fix all errors."
          );
        }
        // Fall through to legacy
      }
    }
  }

  // Fallback: legacy payload without Reed-Solomon
  try {
    return await deserializePayload(raw, password, onProgress);
  } catch (e) {
    if (e instanceof Error && e.message === "PASSWORD_REQUIRED") throw e;
    throw new Error(
      "Failed to decode — the text may be corrupted. Make sure you copied the entire string."
    );
  }
}

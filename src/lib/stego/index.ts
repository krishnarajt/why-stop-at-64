export type { StegoPayload, ProgressStage, OnProgress, DecodeResult } from "./types";

import type { StegoPayload, OnProgress, DecodeResult } from "./types";
import { ARCHIVE_SENTINEL } from "./types";
import {
  serializePayload,
  deserializePayload,
  deserializePayloadV1,
  isPayloadEncrypted,
} from "./format";
import { embedInImage, extractFromImage, decryptDeniable } from "./embed";
import { toText, fromText, isTextEncrypted } from "./textcodec";
import { bundleFiles, unbundleFiles, isContainer, isArchive } from "./container";
import type { ContainerFile } from "./container";

export type { ContainerFile } from "./container";

/**
 * Hide a file inside an image.
 *
 * When password is provided:
 *   - Payload is compressed only (no encryption at format level)
 *   - Entire envelope (magic + payload + end marker) is encrypted at embed level
 *   - Result is plausibly deniable — no recognizable magic bytes in the output
 *
 * When no password:
 *   - Standard V2 format with plaintext magic bytes
 */
export async function encode(
  imageBytes: Uint8Array,
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<Uint8Array> {
  // Deniable: compress only at format level, encrypt at embed level
  // Non-deniable: compress + encrypt at format level, plaintext at embed level
  const formatPassword = password ? undefined : undefined; // never encrypt at format level for new encodes
  const payload = await serializePayload(fileName, fileBytes, formatPassword, onProgress);
  onProgress?.("embedding");
  return embedInImage(imageBytes, payload, password);
}

/**
 * Hide multiple files inside an image.
 * Bundles files into a container, then encodes as a single payload.
 */
export async function encodeMulti(
  imageBytes: Uint8Array,
  files: ContainerFile[],
  password?: string,
  onProgress?: OnProgress
): Promise<Uint8Array> {
  onProgress?.("bundling");
  const containerBytes = bundleFiles(files);
  return encode(imageBytes, containerBytes, ARCHIVE_SENTINEL, password, onProgress);
}

/**
 * Check if an image contains an encrypted/deniable payload.
 */
export function isEncrypted(imageBytes: Uint8Array): boolean {
  const extracted = extractFromImage(imageBytes);
  if (!extracted) return false;
  if (extracted.version === 3) return true; // deniable = always needs password
  if (extracted.version === 2) return isPayloadEncrypted(extracted.payload);
  return false;
}

/**
 * Extract hidden file(s) from an image.
 *
 * Handles:
 *   - V2 standard (plaintext magic, optional format-level encryption for legacy)
 *   - V3 deniable (encrypted envelope, requires password)
 *   - V1 legacy (base64)
 *   - Multi-file containers (auto-detected by archive sentinel filename)
 */
export async function decode(
  imageBytes: Uint8Array,
  password?: string,
  onProgress?: OnProgress
): Promise<DecodeResult | null> {
  onProgress?.("extracting");
  const extracted = extractFromImage(imageBytes);
  if (!extracted) return null;

  let payload: StegoPayload;

  if (extracted.version === 3) {
    // Deniable: decrypt the outer envelope first
    if (!password) throw new Error("PASSWORD_REQUIRED");
    onProgress?.("decrypting");
    const inner = await decryptDeniable(extracted.payload, password);
    if (!inner) throw new Error("Decryption failed — wrong password?");
    // Inner payload has no encryption, just decompress
    payload = await deserializePayload(inner, undefined, onProgress);
  } else if (extracted.version === 2) {
    // Standard V2 — may have format-level encryption (legacy) or not
    payload = await deserializePayload(extracted.payload, password, onProgress);
  } else {
    // V1 legacy
    const v1 = deserializePayloadV1(extracted.payload);
    if (!v1) return null;
    payload = v1;
  }

  // Check if the result is a multi-file container
  if (isArchive(payload.fileName) && isContainer(payload.data)) {
    onProgress?.("unbundling");
    const files = unbundleFiles(payload.data);
    return { fileName: null, data: null, files };
  }

  return { fileName: payload.fileName, data: payload.data, files: null };
}

// --- Text encoding (unchanged API, deniability not applicable) ---

export async function encodeToText(
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<string> {
  return toText(fileBytes, fileName, password, onProgress);
}

export async function encodeMultiToText(
  files: ContainerFile[],
  password?: string,
  onProgress?: OnProgress
): Promise<string> {
  const containerBytes = bundleFiles(files);
  return toText(containerBytes, ARCHIVE_SENTINEL, password, onProgress);
}

export function isTextEncryptedCheck(text: string): boolean {
  return isTextEncrypted(text);
}

export async function decodeFromText(
  text: string,
  password?: string,
  onProgress?: OnProgress
): Promise<DecodeResult> {
  const payload = await fromText(text, password, onProgress);

  if (isArchive(payload.fileName) && isContainer(payload.data)) {
    onProgress?.("unbundling");
    const files = unbundleFiles(payload.data);
    return { fileName: null, data: null, files };
  }

  return { fileName: payload.fileName, data: payload.data, files: null };
}

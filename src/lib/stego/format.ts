import {
  FLAG_COMPRESSED,
  FLAG_ENCRYPTED,
  FLAG_ZSTD,
  type StegoPayload,
  type OnProgress,
} from "./types";
import { compress, decompress, decompressLegacy } from "./compression";
import { encrypt, decrypt } from "./encryption";

/**
 * V2 binary payload format:
 * [FLAGS: 1 byte]
 * [ORIGINAL_SIZE: 4 bytes LE]
 * [FILENAME_LEN: 2 bytes LE]
 * [FILENAME: N bytes UTF-8]
 * [DATA: compressed, optionally encrypted bytes]
 */

export async function serializePayload(
  fileName: string,
  fileBytes: Uint8Array,
  password?: string,
  onProgress?: OnProgress
): Promise<Uint8Array> {
  onProgress?.("compressing");
  let data = await compress(fileBytes);
  let flags = FLAG_ZSTD;

  if (password) {
    onProgress?.("encrypting");
    data = await encrypt(data, password);
    flags |= FLAG_ENCRYPTED;
  }

  const nameBytes = new TextEncoder().encode(fileName);

  // 1 (flags) + 4 (originalSize) + 2 (nameLen) + name + data
  const headerSize = 1 + 4 + 2 + nameBytes.length;
  const result = new Uint8Array(headerSize + data.length);
  const view = new DataView(result.buffer);

  let offset = 0;
  result[offset] = flags;
  offset += 1;
  view.setUint32(offset, fileBytes.length, true);
  offset += 4;
  view.setUint16(offset, nameBytes.length, true);
  offset += 2;
  result.set(nameBytes, offset);
  offset += nameBytes.length;
  result.set(data, offset);

  return result;
}

/**
 * Check if a serialized payload is encrypted by reading the flags byte.
 */
export function isPayloadEncrypted(payloadBytes: Uint8Array): boolean {
  return (payloadBytes[0] & FLAG_ENCRYPTED) !== 0;
}

export async function deserializePayload(
  payloadBytes: Uint8Array,
  password?: string,
  onProgress?: OnProgress
): Promise<StegoPayload> {
  const view = new DataView(
    payloadBytes.buffer,
    payloadBytes.byteOffset,
    payloadBytes.byteLength
  );

  let offset = 0;
  const flags = payloadBytes[offset];
  offset += 1;

  const originalSize = view.getUint32(offset, true);
  offset += 4;

  const nameLen = view.getUint16(offset, true);
  offset += 2;

  const fileName = new TextDecoder().decode(
    payloadBytes.slice(offset, offset + nameLen)
  );
  offset += nameLen;

  let data: Uint8Array = new Uint8Array(payloadBytes.slice(offset));

  if (flags & FLAG_ENCRYPTED) {
    if (!password) {
      throw new Error("PASSWORD_REQUIRED");
    }
    onProgress?.("decrypting");
    data = new Uint8Array(await decrypt(data, password));
  }

  if (flags & FLAG_ZSTD) {
    onProgress?.("decompressing");
    data = new Uint8Array(await decompress(data));
  } else if (flags & FLAG_COMPRESSED) {
    // Legacy DEFLATE
    onProgress?.("decompressing");
    data = new Uint8Array(decompressLegacy(data, originalSize));
  }

  return { fileName, data };
}

/**
 * V1 legacy: payload is "filename\0base64data"
 */
export function deserializePayloadV1(
  payloadBytes: Uint8Array
): StegoPayload | null {
  const payloadStr = new TextDecoder().decode(payloadBytes);
  const nullIndex = payloadStr.indexOf("\0");
  if (nullIndex === -1) return null;

  const fileName = payloadStr.slice(0, nullIndex);
  const base64 = payloadStr.slice(nullIndex + 1);

  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    data[i] = binary.charCodeAt(i);
  }

  return { fileName, data };
}

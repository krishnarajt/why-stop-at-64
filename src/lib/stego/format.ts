import { FLAG_COMPRESSED, type StegoPayload } from "./types";
import { compress, decompress } from "./compression";

/**
 * V2 binary payload format:
 * [FLAGS: 1 byte]
 * [ORIGINAL_SIZE: 4 bytes LE]
 * [FILENAME_LEN: 2 bytes LE]
 * [FILENAME: N bytes UTF-8]
 * [DATA: compressed raw bytes]
 */

export function serializePayload(
  fileName: string,
  fileBytes: Uint8Array
): Uint8Array {
  const compressed = compress(fileBytes);
  const nameBytes = new TextEncoder().encode(fileName);

  // 1 (flags) + 4 (originalSize) + 2 (nameLen) + name + data
  const headerSize = 1 + 4 + 2 + nameBytes.length;
  const result = new Uint8Array(headerSize + compressed.length);
  const view = new DataView(result.buffer);

  let offset = 0;
  // Flags
  result[offset] = FLAG_COMPRESSED;
  offset += 1;
  // Original size
  view.setUint32(offset, fileBytes.length, true);
  offset += 4;
  // Filename length
  view.setUint16(offset, nameBytes.length, true);
  offset += 2;
  // Filename
  result.set(nameBytes, offset);
  offset += nameBytes.length;
  // Compressed data
  result.set(compressed, offset);

  return result;
}

export function deserializePayload(payloadBytes: Uint8Array): StegoPayload {
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

  const compressedData = payloadBytes.slice(offset);

  const data =
    flags & FLAG_COMPRESSED
      ? decompress(compressedData, originalSize)
      : compressedData;

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

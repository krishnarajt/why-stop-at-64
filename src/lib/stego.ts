/**
 * GIF Steganography - hides arbitrary files inside GIF images
 * by appending encoded data after the GIF trailer byte (0x3B).
 *
 * Format: [original GIF bytes] [MAGIC_HEADER] [filename\0] [base64 data] [END_MARKER]
 */

const MAGIC = new TextEncoder().encode("STEG_V1\x00");
const END_MARKER = new TextEncoder().encode("\x00STEG_END");

export function encode(
  gifBytes: Uint8Array,
  fileBytes: Uint8Array,
  fileName: string
): Uint8Array {
  // Find the GIF trailer (0x3B)
  let trailerIndex = -1;
  for (let i = gifBytes.length - 1; i >= 0; i--) {
    if (gifBytes[i] === 0x3b) {
      trailerIndex = i;
      break;
    }
  }
  if (trailerIndex === -1) {
    throw new Error("Invalid GIF: no trailer byte found");
  }

  // Keep everything up to and including the trailer
  const gifPart = gifBytes.slice(0, trailerIndex + 1);

  // Convert the file to base64
  const base64 = uint8ToBase64(fileBytes);
  const payloadStr = fileName + "\0" + base64;
  const payload = new TextEncoder().encode(payloadStr);

  // Assemble: GIF + MAGIC + payload + END_MARKER
  const result = new Uint8Array(
    gifPart.length + MAGIC.length + payload.length + END_MARKER.length
  );
  result.set(gifPart, 0);
  result.set(MAGIC, gifPart.length);
  result.set(payload, gifPart.length + MAGIC.length);
  result.set(
    END_MARKER,
    gifPart.length + MAGIC.length + payload.length
  );

  return result;
}

export function decode(gifBytes: Uint8Array): {
  fileName: string;
  data: Uint8Array;
} | null {
  // Find the magic header after the GIF trailer
  const magicStr = "STEG_V1\x00";
  const endStr = "\x00STEG_END";

  // Search for magic header
  let magicIndex = -1;
  for (let i = 0; i < gifBytes.length - MAGIC.length; i++) {
    if (gifBytes[i] === MAGIC[0]) {
      let match = true;
      for (let j = 0; j < MAGIC.length; j++) {
        if (gifBytes[i + j] !== MAGIC[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        magicIndex = i;
        break;
      }
    }
  }

  if (magicIndex === -1) return null;

  // Find end marker
  let endIndex = -1;
  for (
    let i = magicIndex + MAGIC.length;
    i < gifBytes.length - END_MARKER.length + 1;
    i++
  ) {
    if (gifBytes[i] === END_MARKER[0]) {
      let match = true;
      for (let j = 0; j < END_MARKER.length; j++) {
        if (gifBytes[i + j] !== END_MARKER[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) return null;

  // Extract payload
  const payloadBytes = gifBytes.slice(magicIndex + MAGIC.length, endIndex);
  const payloadStr = new TextDecoder().decode(payloadBytes);

  // Split filename and base64 data
  const nullIndex = payloadStr.indexOf("\0");
  if (nullIndex === -1) return null;

  const fileName = payloadStr.slice(0, nullIndex);
  const base64 = payloadStr.slice(nullIndex + 1);

  const data = base64ToUint8(base64);

  return { fileName, data };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

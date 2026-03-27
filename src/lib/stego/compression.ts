import {
  init as zstdInit,
  compress as zstdCompress,
  decompress as zstdDecompress,
} from "@bokuweb/zstd-wasm";
import { inflateSync } from "fflate";

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await (zstdInit as (path?: string) => Promise<void>)("/zstd.wasm");
    initialized = true;
  }
}

export async function compress(data: Uint8Array): Promise<Uint8Array> {
  await ensureInit();
  return zstdCompress(data, 19);
}

export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  await ensureInit();
  return zstdDecompress(data);
}

/** Legacy DEFLATE decompression for backward-compatible V2 payloads. */
export function decompressLegacy(
  data: Uint8Array,
  originalSize: number
): Uint8Array {
  return inflateSync(data, { out: new Uint8Array(originalSize) });
}

import { deflateSync, inflateSync } from "fflate";

export function compress(data: Uint8Array): Uint8Array {
  return deflateSync(data, { level: 9 });
}

export function decompress(data: Uint8Array, originalSize: number): Uint8Array {
  return inflateSync(data, { out: new Uint8Array(originalSize) });
}

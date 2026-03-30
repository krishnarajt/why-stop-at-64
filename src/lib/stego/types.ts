export interface StegoPayload {
  fileName: string;
  data: Uint8Array;
}

// V2 binary format
export const MAGIC_V2 = new TextEncoder().encode("STEG_V2\x00");
export const END_MARKER = new TextEncoder().encode("\x00STEG_END");

// V1 legacy format
export const MAGIC_V1 = new TextEncoder().encode("STEG_V1\x00");

export const FLAG_COMPRESSED = 0x01;
export const FLAG_ENCRYPTED = 0x02;
export const FLAG_ZSTD = 0x04;

// Multi-file container
export const CONTAINER_MAGIC = new Uint8Array([0x4d, 0x46, 0x01, 0x00]); // "MF\x01\x00"
export const ARCHIVE_SENTINEL = ".stego-archive";

export type ProgressStage =
  | "compressing"
  | "encrypting"
  | "embedding"
  | "encoding-text"
  | "decrypting"
  | "decompressing"
  | "extracting"
  | "bundling"
  | "unbundling"
  | "done";

export type OnProgress = (stage: ProgressStage) => void;

export interface DecodeResult {
  fileName: string | null;
  data: Uint8Array | null;
  files: { path: string; data: Uint8Array }[] | null;
}

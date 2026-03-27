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

export type ProgressStage =
  | "compressing"
  | "encrypting"
  | "embedding"
  | "encoding-text"
  | "decrypting"
  | "decompressing"
  | "extracting"
  | "done";

export type OnProgress = (stage: ProgressStage) => void;

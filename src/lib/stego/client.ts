/**
 * Main-thread client that delegates all stego operations to a Web Worker.
 */

import type { ProgressStage, OnProgress, DecodeResult } from "./types";
export type { DecodeResult } from "./types";
import type { ContainerFile } from "./container";

type WorkerResponse = {
  id: number;
  type: "progress" | "result" | "error";
  stage?: ProgressStage;
  data?: Uint8Array | null;
  fileName?: string | null;
  text?: string;
  encrypted?: boolean;
  message?: string;
  files?: ContainerFile[] | null;
};

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
    onProgress?: OnProgress;
  }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url));
    worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
      const { id, type } = e.data;
      const entry = pending.get(id);
      if (!entry) return;

      if (type === "progress") {
        entry.onProgress?.(e.data.stage!);
        return;
      }

      pending.delete(id);
      if (type === "error") {
        entry.reject(new Error(e.data.message));
      } else {
        entry.resolve(e.data);
      }
    });
  }
  return worker;
}

function call(
  action: string,
  params: Record<string, unknown>,
  onProgress?: OnProgress,
  transfer?: Transferable[]
): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
      onProgress,
    });
    getWorker().postMessage({ id, action, ...params }, transfer ?? []);
  });
}

// --- Single file ---

export async function encode(
  imageBytes: Uint8Array,
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<Uint8Array> {
  const resp = await call(
    "encode",
    { imageBytes, fileBytes, fileName, password },
    onProgress
  );
  return resp.data!;
}

// --- Multi file ---

export async function encodeMulti(
  imageBytes: Uint8Array,
  files: ContainerFile[],
  password?: string,
  onProgress?: OnProgress
): Promise<Uint8Array> {
  const resp = await call(
    "encodeMulti",
    { imageBytes, files, password },
    onProgress
  );
  return resp.data!;
}

// --- Decode ---

export function isEncrypted(imageBytes: Uint8Array): Promise<boolean> {
  return call("isEncrypted", { imageBytes }).then((r) => r.encrypted!);
}

export async function decode(
  imageBytes: Uint8Array,
  password?: string,
  onProgress?: OnProgress
): Promise<DecodeResult | null> {
  const resp = await call("decode", { imageBytes, password }, onProgress);
  if (!resp.data && !resp.files) return null;
  return {
    fileName: resp.fileName ?? null,
    data: resp.data ?? null,
    files: resp.files ?? null,
  };
}

// --- Text encoding ---

export async function encodeToText(
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<string> {
  const resp = await call(
    "encodeToText",
    { fileBytes, fileName, password },
    onProgress
  );
  return resp.text!;
}

export async function encodeMultiToText(
  files: ContainerFile[],
  password?: string,
  onProgress?: OnProgress
): Promise<string> {
  const resp = await call(
    "encodeMultiToText",
    { files, password },
    onProgress
  );
  return resp.text!;
}

export function isTextEncryptedCheck(text: string): Promise<boolean> {
  return call("isTextEncrypted", { text }).then((r) => r.encrypted!);
}

export async function decodeFromText(
  text: string,
  password?: string,
  onProgress?: OnProgress
): Promise<DecodeResult> {
  const resp = await call("decodeFromText", { text, password }, onProgress);
  return {
    fileName: resp.fileName ?? null,
    data: resp.data ?? null,
    files: resp.files ?? null,
  };
}

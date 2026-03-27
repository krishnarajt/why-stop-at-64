/**
 * Main-thread client that delegates all stego operations to a Web Worker.
 * Provides the same API as index.ts but non-blocking.
 */

import type { StegoPayload, ProgressStage, OnProgress } from "./types";

type WorkerResponse = {
  id: number;
  type: "progress" | "result" | "error";
  stage?: ProgressStage;
  data?: Uint8Array | null;
  fileName?: string;
  text?: string;
  encrypted?: boolean;
  message?: string;
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
        return; // don't resolve yet
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

export async function encode(
  gifBytes: Uint8Array,
  fileBytes: Uint8Array,
  fileName: string,
  password?: string,
  onProgress?: OnProgress
): Promise<Uint8Array> {
  const resp = await call(
    "encode",
    { gifBytes, fileBytes, fileName, password },
    onProgress
  );
  return resp.data!;
}

export function isEncrypted(gifBytes: Uint8Array): Promise<boolean> {
  return call("isEncrypted", { gifBytes }).then((r) => r.encrypted!);
}

export async function decode(
  gifBytes: Uint8Array,
  password?: string,
  onProgress?: OnProgress
): Promise<StegoPayload | null> {
  const resp = await call("decode", { gifBytes, password }, onProgress);
  if (!resp.data) return null;
  return { fileName: resp.fileName!, data: resp.data };
}

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

export function isTextEncryptedCheck(text: string): Promise<boolean> {
  return call("isTextEncrypted", { text }).then((r) => r.encrypted!);
}

export async function decodeFromText(
  text: string,
  password?: string,
  onProgress?: OnProgress
): Promise<StegoPayload> {
  const resp = await call("decodeFromText", { text, password }, onProgress);
  return { fileName: resp.fileName!, data: resp.data! };
}

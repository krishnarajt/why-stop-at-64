/**
 * Web Worker that runs all steganography operations off the main thread.
 *
 * Message protocol:
 *   Main → Worker:  { id, action, ...params }
 *   Worker → Main:  { id, type: 'progress' | 'result' | 'error', ... }
 */

import { encode, decode, encodeToText, decodeFromText, isEncrypted, isTextEncryptedCheck } from "./index";
import type { ProgressStage } from "./types";

interface WorkerRequest {
  id: number;
  action: string;
  gifBytes?: Uint8Array;
  fileBytes?: Uint8Array;
  fileName?: string;
  password?: string;
  text?: string;
}

declare const self: Worker;

self.addEventListener("message", async (e: MessageEvent<WorkerRequest>) => {
  const { id, action } = e.data;
  const onProgress = (stage: ProgressStage) => {
    self.postMessage({ id, type: "progress", stage });
  };

  try {
    switch (action) {
      case "encode": {
        const result = await encode(
          e.data.gifBytes!,
          e.data.fileBytes!,
          e.data.fileName!,
          e.data.password,
          onProgress
        );
        self.postMessage({ id, type: "result", data: result }, [result.buffer]);
        break;
      }

      case "decode": {
        const result = await decode(e.data.gifBytes!, e.data.password, onProgress);
        if (result) {
          self.postMessage(
            { id, type: "result", data: result.data, fileName: result.fileName },
            [result.data.buffer]
          );
        } else {
          self.postMessage({ id, type: "result", data: null });
        }
        break;
      }

      case "encodeToText": {
        const text = await encodeToText(
          e.data.fileBytes!,
          e.data.fileName!,
          e.data.password,
          onProgress
        );
        self.postMessage({ id, type: "result", text });
        break;
      }

      case "decodeFromText": {
        const result = await decodeFromText(e.data.text!, e.data.password, onProgress);
        self.postMessage(
          { id, type: "result", data: result.data, fileName: result.fileName },
          [result.data.buffer]
        );
        break;
      }

      case "isEncrypted": {
        const encrypted = isEncrypted(e.data.gifBytes!);
        self.postMessage({ id, type: "result", encrypted });
        break;
      }

      case "isTextEncrypted": {
        const encrypted = isTextEncryptedCheck(e.data.text!);
        self.postMessage({ id, type: "result", encrypted });
        break;
      }

      default:
        self.postMessage({ id, type: "error", message: `Unknown action: ${action}` });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      message: err instanceof Error ? err.message : "Worker error",
    });
  }
});

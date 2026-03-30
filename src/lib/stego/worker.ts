/**
 * Web Worker that runs all steganography operations off the main thread.
 *
 * Message protocol:
 *   Main → Worker:  { id, action, ...params }
 *   Worker → Main:  { id, type: 'progress' | 'result' | 'error', ... }
 */

import {
  encode, encodeMulti, decode, encodeToText, encodeMultiToText,
  decodeFromText, isEncrypted, isTextEncryptedCheck
} from "./index";
import type { ProgressStage, DecodeResult, ContainerFile } from "./index";

interface WorkerRequest {
  id: number;
  action: string;
  imageBytes?: Uint8Array;
  fileBytes?: Uint8Array;
  fileName?: string;
  password?: string;
  text?: string;
  // Multi-file
  files?: { path: string; data: Uint8Array }[];
}

declare const self: Worker;

function sendDecodeResult(id: number, result: DecodeResult | null) {
  if (!result) {
    self.postMessage({ id, type: "result", data: null });
    return;
  }
  if (result.files) {
    // Multi-file result
    self.postMessage({
      id,
      type: "result",
      files: result.files,
    });
  } else {
    // Single file result
    self.postMessage(
      { id, type: "result", data: result.data, fileName: result.fileName },
      result.data ? [result.data.buffer] : []
    );
  }
}

self.addEventListener("message", async (e: MessageEvent<WorkerRequest>) => {
  const { id, action } = e.data;
  const onProgress = (stage: ProgressStage) => {
    self.postMessage({ id, type: "progress", stage });
  };

  try {
    switch (action) {
      case "encode": {
        const result = await encode(
          e.data.imageBytes!,
          e.data.fileBytes!,
          e.data.fileName!,
          e.data.password,
          onProgress
        );
        self.postMessage({ id, type: "result", data: result }, [result.buffer]);
        break;
      }

      case "encodeMulti": {
        const result = await encodeMulti(
          e.data.imageBytes!,
          e.data.files as ContainerFile[],
          e.data.password,
          onProgress
        );
        self.postMessage({ id, type: "result", data: result }, [result.buffer]);
        break;
      }

      case "decode": {
        const result = await decode(e.data.imageBytes!, e.data.password, onProgress);
        sendDecodeResult(id, result);
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

      case "encodeMultiToText": {
        const text = await encodeMultiToText(
          e.data.files as ContainerFile[],
          e.data.password,
          onProgress
        );
        self.postMessage({ id, type: "result", text });
        break;
      }

      case "decodeFromText": {
        const result = await decodeFromText(e.data.text!, e.data.password, onProgress);
        sendDecodeResult(id, result);
        break;
      }

      case "isEncrypted": {
        const encrypted = isEncrypted(e.data.imageBytes!);
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

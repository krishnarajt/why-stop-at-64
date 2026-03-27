"use client";

import { useRef, useState } from "react";
import { decode } from "@/lib/stego";

export default function DecodeUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  async function handleDecode() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus("Please upload a GIF first.");
      return;
    }

    setProcessing(true);
    setStatus("Scanning GIF...");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const result = decode(bytes);
      if (!result) {
        setStatus("No hidden file found in this GIF.");
        return;
      }

      // Download the extracted file
      const blob = new Blob([result.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus(`Extracted: ${result.fileName}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-white mb-1">
        Upload a GIF
      </h2>
      <p className="text-zinc-500 text-sm mb-4">
        Got a GIF from a friend? Upload it to save it to your collection.
      </p>

      <div className="flex gap-3 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/gif"
          className="flex-1 text-sm text-zinc-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 file:cursor-pointer"
        />
        <button
          onClick={handleDecode}
          disabled={processing}
          className="py-2 px-5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg font-medium transition-colors shrink-0"
        >
          {processing ? "..." : "Upload"}
        </button>
      </div>

      {status && (
        <p className="mt-3 text-sm text-zinc-400">{status}</p>
      )}
    </div>
  );
}

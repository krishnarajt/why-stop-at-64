"use client";

import { useCallback, useRef, useState } from "react";
import { decode } from "@/lib/stego";

export default function DecodeUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleDecode() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus("Drop a GIF first!");
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
      setStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setProcessing(false);
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      // Auto-trigger decode
      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, []);

  return (
    <div
      className={`relative max-w-xl mx-auto rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
        dragging
          ? "border-purple-500 bg-purple-500/10 scale-[1.02]"
          : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="mb-3">
        <span className="inline-block text-3xl animate-float">^</span>
      </div>
      <h3 className="text-base font-semibold text-white mb-1">
        Got a GIF from a friend?
      </h3>
      <p className="text-xs text-zinc-500 mb-5">
        Drop it here or click to upload. We&apos;ll add it to your collection.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <label className="cursor-pointer px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.03] active:scale-95">
          Choose GIF
          <input
            ref={fileInputRef}
            type="file"
            accept="image/gif"
            className="hidden"
            onChange={handleDecode}
          />
        </label>
        <span className="text-xs text-zinc-600">or drag & drop</span>
      </div>

      {processing && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-zinc-400">{status}</span>
        </div>
      )}

      {!processing && status && (
        <p className="mt-4 text-sm text-zinc-400 animate-fade-in-up">
          {status}
        </p>
      )}
    </div>
  );
}

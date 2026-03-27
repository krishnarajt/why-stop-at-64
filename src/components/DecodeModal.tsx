"use client";

import { useCallback, useRef, useState } from "react";
import { decode } from "@/lib/stego";

interface DecodeModalProps {
  onClose: () => void;
}

export default function DecodeModal({ onClose }: DecodeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setProcessing(true);
    setStatus("Processing...");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const result = decode(bytes);
      if (!result) {
        setStatus("Nothing here. Try a different file.");
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

      setStatus("Done.");
    } catch {
      setStatus("Something went wrong. Try again.");
    } finally {
      setProcessing(false);
    }
  }

  function handleInputChange() {
    const file = fileInputRef.current?.files?.[0];
    if (file) handleFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-zinc-900 border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl transition-all duration-300 animate-bounce-in ${
          dragging ? "border-purple-500 scale-[1.02]" : "border-zinc-700"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Upload</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-zinc-400 text-sm mb-5">
          Drop a file here or choose one below.
        </p>

        <label className="block cursor-pointer w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-all duration-200 text-center hover:scale-[1.02] active:scale-95">
          Choose File
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleInputChange}
          />
        </label>

        {processing && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-400">{status}</span>
          </div>
        )}

        {!processing && status && (
          <p className="mt-4 text-sm text-zinc-400 animate-fade-in-up text-center">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

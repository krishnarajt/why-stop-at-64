"use client";

import { useRef, useState } from "react";
import { encode } from "@/lib/stego";

interface EncodeModalProps {
  gifUrl: string;
  gifName: string;
  onClose: () => void;
}

export default function EncodeModal({
  gifUrl,
  gifName,
  onClose,
}: EncodeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  async function handleEncode() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus("Please select a file to hide.");
      return;
    }

    setProcessing(true);
    setStatus("Encoding...");

    try {
      // Fetch the GIF
      const gifResp = await fetch(gifUrl);
      const gifBuffer = await gifResp.arrayBuffer();
      const gifBytes = new Uint8Array(gifBuffer);

      // Read the file to hide
      const fileBuffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(fileBuffer);

      // Encode
      const result = encode(gifBytes, fileBytes, file.name);

      // Download
      const blob = new Blob([result as BlobPart], { type: "image/gif" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = gifName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("Done! Your file has been hidden in the GIF.");
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Hide a File</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-zinc-400 text-sm mb-4">
          Select a file to embed inside <span className="text-white font-mono">{gifName}</span>.
          The GIF will look identical but carry your hidden file.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          className="w-full text-sm text-zinc-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer mb-4"
        />

        <button
          onClick={handleEncode}
          disabled={processing}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
        >
          {processing ? "Processing..." : "Encode & Download"}
        </button>

        {status && (
          <p className="mt-3 text-sm text-zinc-300">{status}</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { encode, encodeToText } from "@/lib/stego";

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
  const [textOutput, setTextOutput] = useState<string>("");
  const [copied, setCopied] = useState(false);

  async function handleEncode() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus("Select a file first.");
      return;
    }

    setProcessing(true);
    setStatus("Compressing...");
    setTextOutput("");

    try {
      const [gifBuffer, fileBuffer] = await Promise.all([
        fetch(gifUrl).then((r) => r.arrayBuffer()),
        file.arrayBuffer(),
      ]);

      const gifBytes = new Uint8Array(gifBuffer);
      const fileBytes = new Uint8Array(fileBuffer);

      // Embed compressed raw bytes in GIF
      const result = encode(gifBytes, fileBytes, file.name);

      // Also generate copyable text
      const text = encodeToText(fileBytes, file.name);
      setTextOutput(text);

      // Download the GIF
      const blob = new Blob([result as BlobPart], { type: "image/gif" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = gifName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const saved = ((result.length - gifBytes.length) / fileBytes.length * 100).toFixed(0);
      setStatus(
        `Done. Original: ${formatSize(fileBytes.length)} → Payload: ${formatSize(result.length - gifBytes.length)} (${saved}% of original)`
      );
    } catch {
      setStatus("Something went wrong. Try again.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(textOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-bounce-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Attach</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-zinc-400 text-sm mb-4">
          Select a file. It will be compressed and bundled with{" "}
          <span className="text-white font-mono">{gifName}</span>.
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
          {processing ? "Compressing..." : "Download"}
        </button>

        {status && (
          <p className="mt-3 text-sm text-zinc-300">{status}</p>
        )}

        {textOutput && (
          <div className="mt-4 border-t border-zinc-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400">
                Text version ({textOutput.length} chars)
              </span>
              <button
                onClick={handleCopy}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-all duration-200 ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <textarea
              readOnly
              value={textOutput}
              className="w-full h-28 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-none focus:outline-none focus:border-zinc-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

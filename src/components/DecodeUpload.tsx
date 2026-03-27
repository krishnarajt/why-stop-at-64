"use client";

import { useCallback, useRef, useState } from "react";
import { decode, decodeFromText } from "@/lib/stego";

export default function DecodeUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [textInput, setTextInput] = useState("");

  function downloadResult(data: Uint8Array, fileName: string) {
    const blob = new Blob([data as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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

      downloadResult(result.data, result.fileName);
      setStatus(`Extracted: ${result.fileName}`);
    } catch (err) {
      setStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setProcessing(false);
    }
  }

  function handleTextDecode() {
    if (!textInput.trim()) {
      setStatus("Paste some text first.");
      return;
    }

    setProcessing(true);
    setStatus("Decoding...");

    try {
      const result = decodeFromText(textInput.trim());
      downloadResult(result.data, result.fileName);
      setStatus(`Extracted: ${result.fileName}`);
    } catch {
      setStatus("Invalid text. Make sure you copied the full string.");
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
        Drop it here, upload, or paste encoded text.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg mb-4 max-w-xs mx-auto">
        <button
          onClick={() => { setMode("file"); setStatus(""); }}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
            mode === "file"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          GIF File
        </button>
        <button
          onClick={() => { setMode("text"); setStatus(""); }}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
            mode === "text"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Paste Text
        </button>
      </div>

      {mode === "file" ? (
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
      ) : (
        <div className="max-w-sm mx-auto">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste encoded text here..."
            className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-none focus:outline-none focus:border-zinc-500 mb-3"
          />
          <button
            onClick={handleTextDecode}
            disabled={processing}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
          >
            {processing ? "Decoding..." : "Decode"}
          </button>
        </div>
      )}

      {processing && mode === "file" && (
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

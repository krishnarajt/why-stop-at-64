"use client";

import { useCallback, useRef, useState } from "react";
import { decode, decodeFromText, isEncrypted, isTextEncryptedCheck } from "@/lib/stego/client";
import type { ProgressStage } from "@/lib/stego/types";
import type { DecodeResult } from "@/lib/stego/client";
import { zipSync } from "fflate";
import ProgressBar from "./ProgressBar";

interface DecodeModalProps {
  onClose: () => void;
}

export default function DecodeModal({ onClose }: DecodeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [textInput, setTextInput] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingFile, setPendingFile] = useState<Uint8Array | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [stage, setStage] = useState<ProgressStage | null>(null);

  const onProgress = (s: ProgressStage) => setStage(s);

  function handleDecodeResult(result: DecodeResult | null) {
    if (!result) {
      setStatus("Nothing here. Try a different image.");
      setStage(null);
      return;
    }

    setStage("done");

    if (result.files) {
      // Multi-file: zip and download
      const zipData: Record<string, Uint8Array> = {};
      for (const f of result.files) {
        zipData[f.path] = f.data;
      }
      const zipped = zipSync(zipData);
      downloadResult(zipped, "extracted-files.zip");
      setStatus(`Extracted: ${result.files.length} files (downloaded as ZIP)`);
    } else if (result.data && result.fileName) {
      downloadResult(result.data, result.fileName);
      setStatus(`Extracted: ${result.fileName}`);
    }
  }

  async function handleFile(file: File) {
    setProcessing(true);
    setStatus("");
    setStage(null);
    setNeedsPassword(false);
    setPendingText(null);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (await isEncrypted(bytes)) {
        setPendingFile(bytes);
        setNeedsPassword(true);
        setStatus("This file is encrypted. Enter the password.");
        setProcessing(false);
        return;
      }

      const result = await decode(bytes, undefined, onProgress);
      handleDecodeResult(result);
    } catch {
      setStatus("Something went wrong. Try again.");
      setStage(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleTextDecode() {
    const text = textInput.trim();
    if (!text) {
      setStatus("Paste some text first.");
      return;
    }

    setNeedsPassword(false);
    setPendingFile(null);
    setStage(null);

    try {
      if (await isTextEncryptedCheck(text)) {
        setPendingText(text);
        setNeedsPassword(true);
        setStatus("This text is encrypted. Enter the password.");
        return;
      }

      setProcessing(true);
      setStatus("");

      const result = await decodeFromText(text, undefined, onProgress);
      handleDecodeResult(result);
    } catch {
      setStatus("Invalid text. Make sure you copied the full string.");
      setStage(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handlePasswordSubmit() {
    if (!password) {
      setStatus("Enter a password.");
      return;
    }

    setProcessing(true);
    setStatus("");
    setStage(null);

    try {
      if (pendingFile) {
        const result = await decode(pendingFile, password, onProgress);
        handleDecodeResult(result);
      } else if (pendingText) {
        const result = await decodeFromText(pendingText, password, onProgress);
        handleDecodeResult(result);
      }

      setNeedsPassword(false);
      setPendingFile(null);
      setPendingText(null);
      setPassword("");
    } catch {
      setStatus("Wrong password. Try again.");
      setStage(null);
    } finally {
      setProcessing(false);
    }
  }

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

  function handleInputChange() {
    const file = fileInputRef.current?.files?.[0];
    if (file) handleFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <h2 className="text-lg font-semibold text-white">Extract</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {needsPassword ? (
          <div>
            <p className="text-zinc-400 text-sm mb-3">
              This payload is encrypted.
            </p>
            <div className="relative mb-3">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 pr-16"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePasswordSubmit();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded"
              >
                {showPassword ? "hide" : "show"}
              </button>
            </div>
            <button
              onClick={handlePasswordSubmit}
              disabled={processing}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
            >
              {processing ? "Decrypting..." : "Decrypt"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg mb-4">
              <button
                onClick={() => { setMode("file"); setStatus(""); setStage(null); }}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                  mode === "file"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Image File
              </button>
              <button
                onClick={() => { setMode("text"); setStatus(""); setStage(null); }}
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
              <>
                <p className="text-zinc-400 text-sm mb-5">
                  Drop an image here or choose one below.
                </p>
                <label className="block cursor-pointer w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-all duration-200 text-center hover:scale-[1.02] active:scale-95">
                  Choose File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/gif,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </label>
              </>
            ) : (
              <>
                <p className="text-zinc-400 text-sm mb-3">
                  Paste the encoded text below.
                </p>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste encoded text here..."
                  className="w-full h-28 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-none focus:outline-none focus:border-zinc-500 mb-3"
                />
                <button
                  onClick={handleTextDecode}
                  disabled={processing}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
                >
                  {processing ? "Decoding..." : "Decode"}
                </button>
              </>
            )}
          </>
        )}

        {(processing || stage === "done") && (
          <ProgressBar
            stage={stage}
            mode="decode"
            hasPassword={!!password || needsPassword}
          />
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

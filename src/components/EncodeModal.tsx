"use client";

import { useRef, useState } from "react";
import { encode, encodeToText } from "@/lib/stego/client";
import type { ProgressStage } from "@/lib/stego/types";
import ProgressBar from "./ProgressBar";
import QRCode from "qrcode";

interface EncodeModalProps {
  imageUrl: string;
  imageName: string;
  onClose: () => void;
}

export default function EncodeModal({
  imageUrl,
  imageName,
  onClose,
}: EncodeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [textOutput, setTextOutput] = useState<string>("");
  const [textProcessing, setTextProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stage, setStage] = useState<ProgressStage | null>(null);
  const [lastFileBytes, setLastFileBytes] = useState<Uint8Array | null>(null);
  const [lastFileName, setLastFileName] = useState<string>("");
  const [lastPassword, setLastPassword] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrProcessing, setQrProcessing] = useState(false);
  const [qrError, setQrError] = useState<string>("");

  // QR codes can hold ~2953 bytes; Base32768 chars are 2-3 bytes in UTF-8.
  // Conservative limit: ~1200 chars of Base32768 text ≈ ~2.5KB UTF-8.
  const QR_TEXT_LIMIT = 1200;

  async function handleEncode() {
    const file = selectedFile || fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus("Select a file first.");
      return;
    }

    setProcessing(true);
    setStatus("");
    setTextOutput("");
    setQrDataUrl("");
    setQrError("");
    setStage(null);

    try {
      const [imageBuffer, fileBuffer] = await Promise.all([
        fetch(imageUrl).then((r) => r.arrayBuffer()),
        file.arrayBuffer(),
      ]);

      const imageBytes = new Uint8Array(imageBuffer);
      const fileBytes = new Uint8Array(fileBuffer);
      const pw = password || undefined;

      const onProgress = (s: ProgressStage) => setStage(s);

      const result = await encode(imageBytes, fileBytes, file.name, pw, onProgress);

      setStage("done");
      setLastFileBytes(fileBytes);
      setLastFileName(file.name);
      setLastPassword(pw);

      // Download the image
      const blob = new Blob([result as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = imageName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const payloadSize = result.length - imageBytes.length;
      const ratio = ((payloadSize / fileBytes.length) * 100).toFixed(0);
      setStatus(
        `Done${pw ? " (encrypted)" : ""}. Original: ${formatSize(fileBytes.length)} → Payload: ${formatSize(payloadSize)} (${ratio}% of original)`
      );
    } catch {
      setStatus("Something went wrong. Try again.");
      setStage(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleGenerateText() {
    if (!lastFileBytes) return;
    setTextProcessing(true);
    try {
      const text = await encodeToText(lastFileBytes, lastFileName, lastPassword);
      setTextOutput(text);
    } catch {
      setStatus("Failed to generate text version.");
    } finally {
      setTextProcessing(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(textOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerateQR() {
    if (!textOutput) return;
    setQrProcessing(true);
    setQrError("");
    try {
      const dataUrl = await QRCode.toDataURL(textOutput, {
        errorCorrectionLevel: "L",
        margin: 2,
        width: 300,
        color: { dark: "#e4e4e7", light: "#18181b" }, // zinc-200 on zinc-900
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrError("Payload too large for QR code.");
    } finally {
      setQrProcessing(false);
    }
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
          <span className="text-white font-mono">{imageName}</span>.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-zinc-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer mb-3"
        />

        {/* Capacity indicator */}
        {selectedFile && !processing && stage !== "done" && (
          <div className="mb-3 px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                {selectedFile.name}
              </span>
              <span className="text-zinc-500 font-mono">
                {formatSize(selectedFile.size)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Estimated payload: ~{formatSize(estimatePayload(selectedFile.size))}
              {password && " + encryption overhead"}
            </div>
          </div>
        )}

        {/* Optional password */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-zinc-500">
              Password (optional)
            </label>
            {password && (
              <span className="text-[10px] text-emerald-400 font-medium">
                AES-256 encryption on
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty for no encryption"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded"
            >
              {showPassword ? "hide" : "show"}
            </button>
          </div>
        </div>

        <button
          onClick={handleEncode}
          disabled={processing}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
        >
          {processing ? "Processing..." : "Download"}
        </button>

        {processing && (
          <ProgressBar
            stage={stage}
            mode="encode"
            hasPassword={!!password}
          />
        )}

        {!processing && stage === "done" && (
          <ProgressBar stage="done" mode="encode" hasPassword={!!password} />
        )}

        {status && (
          <p className="mt-3 text-sm text-zinc-300">{status}</p>
        )}

        {/* Text version: generate on demand */}
        {!processing && stage === "done" && !textOutput && (
          <button
            onClick={handleGenerateText}
            disabled={textProcessing}
            className="w-full mt-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
          >
            {textProcessing ? "Generating..." : "Generate text version"}
          </button>
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

            {/* QR code output for small payloads */}
            {textOutput.length <= QR_TEXT_LIMIT && !qrDataUrl && (
              <button
                onClick={handleGenerateQR}
                disabled={qrProcessing}
                className="w-full mt-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-400 rounded-lg text-xs font-medium transition-colors"
              >
                {qrProcessing ? "Generating..." : "Generate QR code"}
              </button>
            )}

            {qrError && (
              <p className="mt-2 text-xs text-red-400">{qrError}</p>
            )}

            {qrDataUrl && (
              <div className="mt-3 flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR code"
                  className="w-[200px] h-[200px] rounded-lg"
                />
                <span className="text-[10px] text-zinc-500">
                  Scan to get the encoded text
                </span>
              </div>
            )}
          </div>
        )}

        {!processing && stage === "done" && (
          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
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

/** Conservative estimate: zstd typically achieves 50-85% compression. Use 50% as a middle estimate. */
function estimatePayload(fileSize: number): number {
  // Header overhead: ~15 bytes (flags + size + name length + short name)
  const headerOverhead = 15;
  // Zstd at level 19 typically compresses to 15-50% of original; use 40% as conservative estimate
  const compressedSize = Math.ceil(fileSize * 0.4);
  return headerOverhead + compressedSize;
}

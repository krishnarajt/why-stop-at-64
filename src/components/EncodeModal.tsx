"use client";

import { useRef, useState } from "react";
import { encode, encodeMulti, encodeToText, encodeMultiToText } from "@/lib/stego/client";
import type { ProgressStage } from "@/lib/stego/types";
import type { ContainerFile } from "@/lib/stego/container";
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
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [textOutput, setTextOutput] = useState<string>("");
  const [textProcessing, setTextProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stage, setStage] = useState<ProgressStage | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrProcessing, setQrProcessing] = useState(false);
  const [qrError, setQrError] = useState<string>("");
  // For text generation after encode
  const [lastContainerFiles, setLastContainerFiles] = useState<ContainerFile[] | null>(null);
  const [lastSingleFile, setLastSingleFile] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [lastPassword, setLastPassword] = useState<string | undefined>();

  const QR_TEXT_LIMIT = 1200;

  const totalSize = selectedFiles.reduce((s, f) => s + f.size, 0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(Array.from(files));
  }

  async function handleEncode() {
    if (selectedFiles.length === 0) {
      setStatus("Select files first.");
      return;
    }

    setProcessing(true);
    setStatus("");
    setTextOutput("");
    setQrDataUrl("");
    setQrError("");
    setStage(null);

    try {
      const imageBuffer = await fetch(imageUrl).then((r) => r.arrayBuffer());
      const imageBytes = new Uint8Array(imageBuffer);
      const pw = password || undefined;
      const onProgress = (s: ProgressStage) => setStage(s);

      let result: Uint8Array;
      let originalSize: number;

      if (selectedFiles.length === 1) {
        // Single file — use simple encode
        const file = selectedFiles[0];
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        result = await encode(imageBytes, fileBytes, file.name, pw, onProgress);
        originalSize = fileBytes.length;
        setLastSingleFile({ bytes: fileBytes, name: file.name });
        setLastContainerFiles(null);
      } else {
        // Multi-file — bundle into container
        const containerFiles: ContainerFile[] = await Promise.all(
          selectedFiles.map(async (f) => ({
            path: f.webkitRelativePath || f.name,
            data: new Uint8Array(await f.arrayBuffer()),
          }))
        );
        result = await encodeMulti(imageBytes, containerFiles, pw, onProgress);
        originalSize = containerFiles.reduce((s, f) => s + f.data.length, 0);
        setLastContainerFiles(containerFiles);
        setLastSingleFile(null);
      }

      setStage("done");
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
      const ratio = ((payloadSize / originalSize) * 100).toFixed(0);
      const fileLabel = selectedFiles.length === 1
        ? ""
        : ` (${selectedFiles.length} files)`;
      setStatus(
        `Done${pw ? " (encrypted, deniable)" : ""}${fileLabel}. Original: ${formatSize(originalSize)} → Payload: ${formatSize(payloadSize)} (${ratio}% of original)`
      );
    } catch {
      setStatus("Something went wrong. Try again.");
      setStage(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleGenerateText() {
    setTextProcessing(true);
    try {
      let text: string;
      if (lastContainerFiles) {
        text = await encodeMultiToText(lastContainerFiles, lastPassword);
      } else if (lastSingleFile) {
        text = await encodeToText(lastSingleFile.bytes, lastSingleFile.name, lastPassword);
      } else {
        return;
      }
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
        color: { dark: "#e4e4e7", light: "#18181b" },
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
          Select files or a folder. They will be compressed and bundled with{" "}
          <span className="text-white font-mono">{imageName}</span>.
        </p>

        {/* File and folder inputs */}
        <div className="flex gap-2 mb-3">
          <label className="flex-1 cursor-pointer text-center py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors">
            Files
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <label className="flex-1 cursor-pointer text-center py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors">
            Folder
            <input
              ref={folderInputRef}
              type="file"
              /* @ts-expect-error webkitdirectory is non-standard but widely supported */
              webkitdirectory=""
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Capacity indicator */}
        {selectedFiles.length > 0 && !processing && stage !== "done" && (
          <div className="mb-3 px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                {selectedFiles.length === 1
                  ? selectedFiles[0].name
                  : `${selectedFiles.length} files`}
              </span>
              <span className="text-zinc-500 font-mono">
                {formatSize(totalSize)}
              </span>
            </div>
            {selectedFiles.length > 1 && (
              <div className="mt-1 text-[10px] text-zinc-600 max-h-16 overflow-y-auto">
                {selectedFiles.slice(0, 10).map((f, i) => (
                  <div key={i} className="truncate">
                    {f.webkitRelativePath || f.name}
                  </div>
                ))}
                {selectedFiles.length > 10 && (
                  <div>...and {selectedFiles.length - 10} more</div>
                )}
              </div>
            )}
            <div className="mt-1 text-[11px] text-zinc-500">
              Estimated payload: ~{formatSize(estimatePayload(totalSize))}
              {password && " (encrypted, deniable)"}
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
                AES-256 + deniable
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
        {!processing && stage === "done" && !textOutput && (lastSingleFile || lastContainerFiles) && (
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

function estimatePayload(fileSize: number): number {
  const headerOverhead = 15;
  const compressedSize = Math.ceil(fileSize * 0.4);
  return headerOverhead + compressedSize;
}

"use client";

import type { ProgressStage } from "@/lib/stego";

const ENCODE_STAGES: ProgressStage[] = [
  "compressing",
  "encrypting",
  "embedding",
  "done",
];
const DECODE_STAGES: ProgressStage[] = [
  "extracting",
  "decrypting",
  "decompressing",
  "done",
];

const LABELS: Record<ProgressStage, string> = {
  compressing: "Compressing (Zstd)",
  encrypting: "Encrypting (AES-256)",
  embedding: "Embedding in GIF",
  "encoding-text": "Encoding text",
  decrypting: "Decrypting",
  decompressing: "Decompressing (Zstd)",
  extracting: "Extracting payload",
  done: "Done",
};

interface ProgressBarProps {
  stage: ProgressStage | null;
  mode: "encode" | "decode";
  hasPassword?: boolean;
}

export default function ProgressBar({
  stage,
  mode,
  hasPassword,
}: ProgressBarProps) {
  if (!stage) return null;

  const allStages = mode === "encode" ? ENCODE_STAGES : DECODE_STAGES;
  // Filter to only relevant stages
  const stages = allStages.filter((s) => {
    if (s === "encrypting" && !hasPassword) return false;
    if (s === "decrypting" && !hasPassword) return false;
    if (s === "encoding-text" && mode === "decode") return false;
    return true;
  });

  const currentIndex = stages.indexOf(stage);
  const progress =
    stage === "done"
      ? 100
      : currentIndex >= 0
        ? Math.round(((currentIndex + 0.5) / (stages.length - 1)) * 100)
        : 0;

  return (
    <div className="mt-3 space-y-2">
      {/* Bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background:
              stage === "done"
                ? "rgb(16 185 129)"
                : "linear-gradient(90deg, rgb(168 85 247), rgb(99 102 241))",
          }}
        />
      </div>
      {/* Label */}
      <div className="flex items-center gap-2">
        {stage !== "done" && (
          <span className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {stage === "done" && (
          <span className="text-emerald-400 text-xs">&#10003;</span>
        )}
        <span className="text-xs text-zinc-400">{LABELS[stage]}</span>
      </div>
    </div>
  );
}

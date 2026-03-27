"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgressStage } from "@/lib/stego";

// Weighted cost of each stage (relative units, not seconds).
// Compression dominates; encryption and embedding are fast.
const STAGE_WEIGHT: Record<ProgressStage, number> = {
  bundling: 2,
  compressing: 70,
  encrypting: 10,
  embedding: 5,
  "encoding-text": 5,
  extracting: 5,
  decrypting: 10,
  decompressing: 70,
  unbundling: 2,
  done: 0,
};

const LABELS: Record<ProgressStage, string> = {
  bundling: "Bundling files",
  compressing: "Compressing (Zstd)",
  encrypting: "Encrypting (AES-256)",
  embedding: "Embedding in image",
  "encoding-text": "Encoding text",
  decrypting: "Decrypting",
  decompressing: "Decompressing (Zstd)",
  extracting: "Extracting payload",
  unbundling: "Unpacking files",
  done: "Done",
};

const ENCODE_STAGES: ProgressStage[] = [
  "bundling",
  "compressing",
  "encrypting",
  "embedding",
  "done",
];
const DECODE_STAGES: ProgressStage[] = [
  "extracting",
  "decrypting",
  "decompressing",
  "unbundling",
  "done",
];

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
  const [displayProgress, setDisplayProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const stageStartRef = useRef(0);

  // Compute the target progress based on current stage
  const allStages = mode === "encode" ? ENCODE_STAGES : DECODE_STAGES;
  const stages = allStages.filter((s) => {
    if (s === "encrypting" && !hasPassword) return false;
    if (s === "decrypting" && !hasPassword) return false;
    if (s === "encoding-text" && mode === "decode") return false;
    if (s === "bundling" && stage !== "bundling") return false;
    if (s === "unbundling" && stage !== "unbundling") return false;
    return true;
  });

  // Build cumulative weight ranges for each stage
  const totalWeight = stages.reduce((sum, s) => sum + STAGE_WEIGHT[s], 0);
  let cumulativeStart = 0;
  const stageRanges = new Map<ProgressStage, { start: number; end: number }>();
  for (const s of stages) {
    const w = STAGE_WEIGHT[s];
    const start = cumulativeStart / totalWeight;
    const end = (cumulativeStart + w) / totalWeight;
    stageRanges.set(s, { start, end });
    cumulativeStart += w;
  }

  useEffect(() => {
    if (!stage) return;

    if (stage === "done") {
      targetRef.current = 100;
      // Snap to 100 quickly
      cancelAnimationFrame(rafRef.current);
      const snapTo100 = () => {
        currentRef.current += (100 - currentRef.current) * 0.3;
        if (currentRef.current >= 99.5) {
          currentRef.current = 100;
          setDisplayProgress(100);
          return;
        }
        setDisplayProgress(Math.round(currentRef.current));
        rafRef.current = requestAnimationFrame(snapTo100);
      };
      rafRef.current = requestAnimationFrame(snapTo100);
      return;
    }

    const range = stageRanges.get(stage);
    if (!range) return;

    // When entering a new stage, jump to the start of that stage's range,
    // then animate toward ~90% of the stage's range (never reaching 100%
    // of the stage until the next stage starts — mimics real progress).
    const stageStart = range.start * 100;
    const stageEnd = range.start * 100 + (range.end - range.start) * 100 * 0.92;

    // If we're behind the stage start (e.g. stages completed faster than animation),
    // snap forward to the stage start
    if (currentRef.current < stageStart) {
      currentRef.current = stageStart;
    }

    targetRef.current = stageEnd;
    stageStartRef.current = performance.now();

    cancelAnimationFrame(rafRef.current);

    const animate = () => {
      const elapsed = performance.now() - stageStartRef.current;
      // Ease-out curve: fast start, slow approach to target
      // Use elapsed time to create smooth animation independent of frame rate
      const t = 1 - Math.exp(-elapsed / 800); // ~800ms time constant
      const target = targetRef.current;
      const start = currentRef.current;
      const newProgress = start + (target - start) * t;

      currentRef.current = newProgress;
      setDisplayProgress(Math.round(newProgress));

      // Keep animating as long as we haven't reached the target
      if (newProgress < target - 0.5) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (!stage) return null;

  return (
    <div className="mt-3 space-y-2">
      {/* Bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${displayProgress}%`,
            background:
              stage === "done"
                ? "rgb(16 185 129)"
                : "linear-gradient(90deg, rgb(168 85 247), rgb(99 102 241))",
            transition: stage === "done" ? "width 300ms ease-out" : "none",
          }}
        />
      </div>
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {stage !== "done" && (
            <span className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {stage === "done" && (
            <span className="text-emerald-400 text-xs">&#10003;</span>
          )}
          <span className="text-xs text-zinc-400">{LABELS[stage]}</span>
        </div>
        <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
          {displayProgress}%
        </span>
      </div>
    </div>
  );
}

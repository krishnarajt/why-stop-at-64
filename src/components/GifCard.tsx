"use client";

import { useCallback, useRef, useState } from "react";
import EncodeModal from "./EncodeModal";

interface GifCardProps {
  src: string;
  name: string;
  index: number;
}

export default function GifCard({ src, name, index }: GifCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCornerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x > 40 || y > 40) return;

      e.stopPropagation();
      e.preventDefault();

      clickCount.current += 1;

      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 800);

      if (clickCount.current >= 3) {
        clickCount.current = 0;
        if (clickTimer.current) clearTimeout(clickTimer.current);
        setShowModal(true);
      }
    },
    []
  );

  function handleDownload() {
    const a = document.createElement("a");
    a.href = src;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  // Clean display name: remove extension and replace hyphens/underscores
  const displayName = name
    .replace(/\.gif$/i, "")
    .replace(/[-_]/g, " ");

  return (
    <>
      <div
        className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/5 animate-fade-in-up"
        style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
      >
        {/* Number badge */}
        <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="text-[10px] text-zinc-400 font-mono">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div
          className="relative aspect-square cursor-pointer overflow-hidden"
          onClick={handleCornerClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          {/* Hover overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div className="p-3 flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500 group-hover:text-zinc-300 truncate transition-colors duration-200 capitalize">
            {displayName}
          </span>
          <button
            onClick={handleDownload}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 shrink-0 ${
              downloaded
                ? "bg-emerald-500/20 text-emerald-400 scale-105"
                : "bg-zinc-800 hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300"
            }`}
          >
            {downloaded ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {showModal && (
        <EncodeModal
          gifUrl={src}
          gifName={name}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

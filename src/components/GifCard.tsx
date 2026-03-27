"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import EncodeModal from "./EncodeModal";

interface GifCardProps {
  src: string;
  name: string;
}

export default function GifCard({ src, name }: GifCardProps) {
  const [showModal, setShowModal] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCornerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only respond to clicks in the top-left 40x40px area
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
  }

  return (
    <>
      <div className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors">
        <div className="relative aspect-square cursor-pointer" onClick={handleCornerClick}>
          <Image
            src={src}
            alt={name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="p-3 flex items-center justify-between">
          <span className="text-sm text-zinc-400 truncate">{name}</span>
          <button
            onClick={handleDownload}
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            Save
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

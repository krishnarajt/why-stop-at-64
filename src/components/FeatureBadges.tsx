"use client";

import { useCallback, useRef, useState } from "react";
import DecodeModal from "./DecodeModal";

const features = [
  {
    icon: "O",
    title: "Zero Sign-Up",
    desc: "We don't even have a database. Where would we store your email? Exactly.",
  },
  {
    icon: "|>",
    title: "Instant Downloads",
    desc: "Click. Download. Done. No 5-second countdown. No 'skip ad' button.",
  },
  {
    icon: "#",
    title: "Curated by Humans",
    desc: "Each GIF hand-selected by a person with impeccable taste and too much free time.",
  },
  {
    icon: "~",
    title: "Safe & Secure",
    desc: "No scripts running in the background. No data collection. Your privacy, respected.",
    secret: true,
  },
];

export default function FeatureBadges() {
  const [showDecode, setShowDecode] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretClick = useCallback(() => {
    clickCount.current += 1;

    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickCount.current = 0;
    }, 800);

    if (clickCount.current >= 3) {
      clickCount.current = 0;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      setShowDecode(true);
    }
  }, []);

  return (
    <>
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-purple-500/30 hover:bg-zinc-900/80 transition-all duration-300 animate-fade-in-up select-none"
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={f.secret ? handleSecretClick : undefined}
            >
              <div className="w-10 h-10 bg-zinc-800 group-hover:bg-purple-500/20 rounded-lg flex items-center justify-center mb-3 transition-colors duration-300">
                <span className="text-zinc-400 group-hover:text-purple-400 text-sm font-mono font-bold transition-colors duration-300">
                  {f.icon}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {showDecode && <DecodeModal onClose={() => setShowDecode(false)} />}
    </>
  );
}

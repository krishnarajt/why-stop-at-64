"use client";

const items = [
  "NO SIGN UP REQUIRED",
  "FREE FOREVER",
  "NO TRACKING",
  "NO COOKIES",
  "NO ADS",
  "NO PAYWALL",
  "NO NEWSLETTER",
  "JUST GIFS",
  "NO LOGIN",
  "NO PASSWORD",
  "NO PREMIUM TIER",
  "NO DARK PATTERNS",
];

export default function Marquee() {
  const doubled = [...items, ...items];

  return (
    <div className="relative border-y border-zinc-800 bg-zinc-900/40 py-3 overflow-hidden select-none">
      <div className="animate-marquee flex whitespace-nowrap gap-8">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-8 text-xs font-bold tracking-widest text-zinc-500">
            <span>{item}</span>
            <span className="text-purple-500/50">*</span>
          </span>
        ))}
      </div>
    </div>
  );
}

import fs from "fs";
import path from "path";
import GifCard from "@/components/GifCard";
import Marquee from "@/components/Marquee";
import FeatureBadges from "@/components/FeatureBadges";

export const dynamic = "force-dynamic";

function getGifs() {
  const dir = path.join(process.cwd(), "public", "gifs");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".gif"))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => ({ src: `/gifs/${f.replace(/ /g, "%20")}`, name: f }));
}

export default function Home() {
  const gifs = getGifs();

  return (
    <main className="flex-1 overflow-x-hidden">
      {/* Nav */}
      <nav className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl animate-wiggle inline-block">~</span>
            <span className="font-bold text-white text-sm tracking-tight">whystopat64</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="hidden sm:inline">no login</span>
            <span className="hidden sm:inline">no tracking</span>
            <span className="hidden sm:inline">no bs</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {gifs.length} GIFs live
            </span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="animate-fade-in-up">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-zinc-800 text-zinc-300 rounded-full mb-6 border border-zinc-700">
              100% free forever. seriously.
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black text-white mb-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            Why Stop at <span className="shimmer-text">64</span>?
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-4 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            The internet&apos;s most curated, hand-picked, artisanally-sourced
            collection of exactly <strong className="text-white">64 GIFs</strong>.
          </p>
          <p className="text-sm text-zinc-500 max-w-lg mx-auto mb-8 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            No sign-up. No login. No email. No password. No two-factor auth.
            No cookie consent popup. No newsletter. No premium tier.
            Just GIFs.
          </p>

        </div>
      </section>

      {/* Scrolling Marquee */}
      <Marquee />

      {/* Feature Badges */}
      <FeatureBadges />

      {/* GIF Grid */}
      <section className="max-w-7xl mx-auto px-4 pt-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white animate-slide-in-left">
              The Collection
            </h2>
            <p className="text-zinc-500 text-sm mt-1 animate-slide-in-left" style={{ animationDelay: "100ms" }}>
              {gifs.length} GIFs, each one a masterpiece. Click any to download.
            </p>
          </div>
          <span className="text-xs text-zinc-600 animate-slide-in-right hidden sm:block">
            updated whenever we feel like it
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 stagger-children">
          {gifs.map((gif, i) => (
            <GifCard key={gif.name} src={gif.src} name={gif.name} index={i} />
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">
            That&apos;s it. That&apos;s the site.
          </h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
            No account creation flow. No onboarding wizard. No &quot;complete your profile&quot; prompt.
            We respect your time and your inbox.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            <span className="px-3 py-1.5 bg-zinc-800/50 text-zinc-400 rounded-full border border-zinc-700/50">zero cookies</span>
            <span className="px-3 py-1.5 bg-zinc-800/50 text-zinc-400 rounded-full border border-zinc-700/50">zero trackers</span>
            <span className="px-3 py-1.5 bg-zinc-800/50 text-zinc-400 rounded-full border border-zinc-700/50">zero regrets</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xl animate-spin-slow inline-block">~</span>
            <span className="font-bold text-zinc-400">whystopat64</span>
          </div>
          <p className="text-zinc-600 text-xs text-center">
            Made with questionable taste and zero venture capital.
            No data was harvested in the making of this site.
          </p>
          <p className="text-zinc-700 text-xs">
            &copy; forever, probably
          </p>
        </div>
      </footer>
    </main>
  );
}

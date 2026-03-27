import fs from "fs";
import path from "path";
import GifCard from "@/components/GifCard";
import DecodeUpload from "@/components/DecodeUpload";

function getGifs() {
  const dir = path.join(process.cwd(), "public", "gifs");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".gif"))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => ({ src: `/gifs/${encodeURIComponent(f)}`, name: f }));
}

export default function Home() {
  const gifs = getGifs();

  return (
    <main className="flex-1">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white">
            Why Stop at 64?
          </h1>
          <p className="text-zinc-500 mt-2">
            The internet&apos;s finest collection of 64 GIFs. Download, share, enjoy.
          </p>
        </div>
      </div>

      {/* GIF Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {gifs.map((gif) => (
            <GifCard key={gif.name} src={gif.src} name={gif.name} />
          ))}
        </div>
      </div>

      {/* Decode / Upload Section */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <DecodeUpload />
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-zinc-600 text-sm">
          Just vibes. Nothing to see here.
        </div>
      </footer>
    </main>
  );
}

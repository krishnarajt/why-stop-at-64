# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` - Start dev server (Next.js 16, port 3000)
- `npm run build` - Production build
- `npm run lint` - ESLint (flat config, `eslint.config.mjs`)

No test framework is configured.

## Architecture

A Next.js 16 App Router site that displays a curated collection of exactly 64 GIFs with a hidden steganography feature.

**GIF discovery is server-side**: [page.tsx](src/app/page.tsx) reads `public/gifs/` at request time (`force-dynamic`) using `fs.readdirSync`. To add/remove GIFs, just add/remove `.gif` files in that directory.

**Hidden steganography feature**: Triple-clicking the top-left corner (40x40px) of any GIF card opens an encode modal. This lets users attach an arbitrary file inside a GIF by appending data after the GIF trailer byte (`0x3B`). The decode modal lets users extract hidden files from uploaded GIFs.

Key modules:
- [src/lib/stego.ts](src/lib/stego.ts) - `encode()` and `decode()` functions for GIF steganography (format: `[GIF bytes][MAGIC_HEADER][filename\0][base64 data][END_MARKER]`)
- [src/components/GifCard.tsx](src/components/GifCard.tsx) - Client component with download + hidden triple-click to open encode modal
- [src/components/EncodeModal.tsx](src/components/EncodeModal.tsx) - Client-side file encoding into GIF
- [src/components/DecodeModal.tsx](src/components/DecodeModal.tsx) - Client-side file extraction from GIF
- [src/components/DecodeUpload.tsx](src/components/DecodeUpload.tsx) - Upload interface for decoding

Styling: Tailwind CSS v4 with custom animations defined in [globals.css](src/app/globals.css). Dark theme (zinc-950 background).

## Important Notes

- **Next.js 16**: This uses Next.js 16.2.1 which has breaking changes from earlier versions. Read docs in `node_modules/next/dist/docs/` before making changes.
- The steganography UI is intentionally hidden - do not make it more discoverable.

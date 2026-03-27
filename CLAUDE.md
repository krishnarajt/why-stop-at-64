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

**Hidden steganography feature**: Triple-clicking the top-left corner (40x40px) of any GIF card opens an encode modal. Triple-clicking "Safe & Secure" badge opens the decode modal. Pipeline: compress (DEFLATE) → optionally encrypt (AES-256-GCM) → embed raw bytes after GIF trailer (0x3B). Also generates a Base32768 text representation for sharing. Decode supports both GIF upload and pasted text, with automatic password prompting for encrypted payloads.

Stego modules (`src/lib/stego/`):
- [index.ts](src/lib/stego/index.ts) - Public API: `encode`, `decode`, `encodeToText`, `decodeFromText`, `isEncrypted`
- [types.ts](src/lib/stego/types.ts) - Constants (magic bytes, flags) and `StegoPayload` type
- [compression.ts](src/lib/stego/compression.ts) - DEFLATE level 9 via fflate
- [encryption.ts](src/lib/stego/encryption.ts) - AES-256-GCM via Web Crypto API (PBKDF2 key derivation)
- [embed.ts](src/lib/stego/embed.ts) - GIF binary embedding (find trailer, insert/extract)
- [format.ts](src/lib/stego/format.ts) - V2 binary format serialization + V1 legacy fallback
- [textcodec.ts](src/lib/stego/textcodec.ts) - Base32768 Unicode text encoding

Components:
- [GifCard.tsx](src/components/GifCard.tsx) - Client component with download + hidden triple-click to open encode modal
- [EncodeModal.tsx](src/components/EncodeModal.tsx) - File encoding with optional password, shows Base32768 text output
- [DecodeModal.tsx](src/components/DecodeModal.tsx) - File extraction from GIF or pasted text, password prompt for encrypted payloads
- [DecodeUpload.tsx](src/components/DecodeUpload.tsx) - Inline upload/paste interface for decoding

Styling: Tailwind CSS v4 with custom animations defined in [globals.css](src/app/globals.css). Dark theme (zinc-950 background).

## Important Notes

- **Next.js 16**: This uses Next.js 16.2.1 which has breaking changes from earlier versions. Read docs in `node_modules/next/dist/docs/` before making changes.
- The steganography UI is intentionally hidden - do not make it more discoverable.

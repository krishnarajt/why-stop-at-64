# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` - Start dev server (Next.js 16, port 3000)
- `npm run build` - Production build
- `npm run lint` - ESLint (flat config, `eslint.config.mjs`)

No test framework is configured.

## Architecture

A Next.js 16 App Router site that displays a curated image collection with a hidden steganography feature.

**Image discovery is server-side**: [page.tsx](src/app/page.tsx) reads `public/gifs/` at request time (`force-dynamic`) using `fs.readdirSync`. Supports `.gif`, `.png`, `.jpg`, `.jpeg`, and `.webp` files. To add/remove images, just add/remove files in that directory.

**Hidden steganography feature**: Triple-clicking the top-left corner (40x40px) of any image card opens an encode modal. Triple-clicking "Safe & Secure" badge opens the decode modal. Pipeline: compress (Zstd level 19 via WASM) → optionally encrypt (AES-256-GCM with plausible deniability) → embed raw bytes after the image's end-of-file marker. Supports GIF, PNG, JPEG, and WebP carriers. Supports multi-file and folder uploads (bundled into a binary container). Also generates a Base32768 text representation (with Reed-Solomon error correction) for sharing, and a QR code for small payloads. Decode supports image upload and pasted text, with automatic password prompting for encrypted/deniable payloads. Multi-file results are auto-zipped for download. Progress bars show pipeline stage during encode/decode.

Stego modules (`src/lib/stego/`):
- [index.ts](src/lib/stego/index.ts) - Public API: `encode`, `encodeMulti`, `decode`, `encodeToText`, `decodeFromText`, `isEncrypted`
- [types.ts](src/lib/stego/types.ts) - Constants (magic bytes, flags), `StegoPayload`, `DecodeResult` types
- [container.ts](src/lib/stego/container.ts) - Multi-file container: `bundleFiles`, `unbundleFiles`, `isContainer`
- [compression.ts](src/lib/stego/compression.ts) - Zstd level 19 via @bokuweb/zstd-wasm (WASM, lazy-loaded), DEFLATE fallback for legacy decode
- [encryption.ts](src/lib/stego/encryption.ts) - AES-256-GCM via Web Crypto API (PBKDF2 key derivation)
- [embed.ts](src/lib/stego/embed.ts) - Multi-format image embedding + plausible deniability (envelope encryption at embed layer)
- [format.ts](src/lib/stego/format.ts) - V2 binary format serialization + V1 legacy fallback
- [reed-solomon.ts](src/lib/stego/reed-solomon.ts) - Reed-Solomon error correction over GF(2^8), multi-block
- [textcodec.ts](src/lib/stego/textcodec.ts) - Base32768 Unicode text encoding + RS error correction

Components:
- [ImageCard.tsx](src/components/ImageCard.tsx) - Client component with download + hidden triple-click to open encode modal
- [EncodeModal.tsx](src/components/EncodeModal.tsx) - Multi-file/folder encoding with optional password (deniable), Base32768 text + QR code
- [DecodeModal.tsx](src/components/DecodeModal.tsx) - File extraction from image or pasted text, multi-file ZIP download, password prompt for encrypted/deniable payloads
- [DecodeUpload.tsx](src/components/DecodeUpload.tsx) - Inline upload/paste interface for decoding (same features as DecodeModal)
- [ProgressBar.tsx](src/components/ProgressBar.tsx) - Shared progress bar showing pipeline stages during encode/decode

Styling: Tailwind CSS v4 with custom animations defined in [globals.css](src/app/globals.css). Dark theme (zinc-950 background).

## Important Notes

- **Next.js 16**: This uses Next.js 16.2.1 which has breaking changes from earlier versions. Read docs in `node_modules/next/dist/docs/` before making changes.
- The steganography UI is intentionally hidden - do not make it more discoverable.

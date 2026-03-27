# Why Stop at 64?

A curated image collection with a hidden steganography system that lets you compress, optionally encrypt, and hide arbitrary files inside images (GIF, PNG, JPEG, WebP) — then share them as plain text or QR codes.

The name isn't about 64 GIFs. It's about **Base64**, and why we decided not to stop there.

---

## The Question

Base64 is everywhere. It's how the internet encodes binary data into text — email attachments, data URIs, API payloads. It takes every 3 bytes of data and maps them to 4 printable ASCII characters. Simple, universal, and wasteful: a 33% size overhead on everything it touches.

So we asked: why stop at 64?

## Encoding vs. Compression

These are fundamentally different operations, and confusing them is the root of most misconceptions about "higher bases."

**Encoding** is a representation change. You're expressing the same information using a different alphabet. Base64 uses 64 characters (A-Z, a-z, 0-9, +, /), encoding 6 bits per character. Base85 uses 85 characters, encoding ~6.4 bits. Base32768 uses 32,768 Unicode characters, encoding 15 bits per character. No matter the base, encoding can never make data smaller in terms of information — it can only change how many characters you need. The byte count may even go *up* depending on how those characters are stored (more on this below).

**Compression** actually removes data — specifically, redundancy. Real files aren't random noise. Text has predictable letter frequencies. Images have regions of similar color. Code repeats patterns. Compression algorithms like DEFLATE and Zstandard exploit this:

1. **Dictionary substitution** (LZ77): Find repeated byte sequences, store them once, reference them everywhere else. The word "the" appears 50 times? Store it once, emit 49 tiny back-references.
2. **Entropy coding** (Huffman): Give frequent bytes short bit patterns and rare bytes long ones. Same idea as Morse code — "E" is a single dot because it's the most common letter.

The theoretical floor is Shannon entropy: the minimum bits required to represent the actual information content. A file of all zeros compresses to nearly nothing. A truly random file can't be compressed at all.

## What We Did

We built a five-stage pipeline, each stage modular and independently replaceable:

### Stage 1: Compression (Zstandard, level 19)

Before doing anything else, we compress the file using [Zstandard (zstd)](https://facebook.github.io/zstd/) at level 19 via [@bokuweb/zstd-wasm](https://github.com/bokuweb/zstd-wasm) — a WebAssembly build of Facebook's reference implementation. Zstd achieves 10-30% better compression ratios than DEFLATE at comparable speeds, and significantly better ratios on larger files. The WASM module (~300KB) is lazily loaded on first use from `/zstd.wasm`, so there's zero cost if the steganography feature is never triggered. Typical files shrink 50-85%.

Legacy payloads compressed with the original DEFLATE pipeline (via [fflate](https://github.com/101arrowz/fflate)) are still supported for decoding. The FLAGS byte distinguishes between the two: `FLAG_ZSTD` (bit 2) for new payloads, `FLAG_COMPRESSED` (bit 0) for legacy DEFLATE.

### Stage 2: Encryption (AES-256-GCM, optional)

If the user provides a password, the compressed data is encrypted using AES-256-GCM via the Web Crypto API — no additional dependencies needed, it's built into every modern browser.

The process:
1. A random 16-byte salt is generated.
2. The password is run through PBKDF2 (100,000 iterations, SHA-256) with the salt to derive a 256-bit AES key. PBKDF2's high iteration count makes brute-force attacks on weak passwords computationally expensive.
3. A random 12-byte IV (initialization vector) is generated.
4. The compressed data is encrypted with AES-256-GCM, which provides both confidentiality and authentication — if even one bit is tampered with, decryption fails entirely.

The encrypted output is stored as `[salt][iv][ciphertext]`. The salt and IV are not secret; they just need to be unique per encryption. The password never leaves the browser.

The FLAGS byte in the binary header records whether encryption was applied (bit 1). On decode, the system checks this flag: if set, it prompts for a password before attempting decryption. If the wrong password is entered, AES-GCM's authentication tag check fails immediately — there's no silent corruption, just a clear "wrong password" error.

Encryption is entirely optional. If no password is provided, this stage is skipped and the pipeline behaves exactly as it would without it.

### Stage 3: Binary Embedding (Raw Bytes in Images)

The original implementation used Base64 to encode data before hiding it in a GIF. This was unnecessary. Image files are binary — every byte position after the format's end-of-file marker can hold any value from 0x00 to 0xFF. There's no text-safety constraint. Encoding to Base64 was inflating the payload by 33% for zero benefit.

We dropped Base64 entirely and store raw compressed (and optionally encrypted) bytes directly. The embedding works with four image formats, each with its own end-of-file marker:

| Format | End marker | Detection |
|--------|-----------|-----------|
| GIF | `0x3B` trailer byte | Scan backwards for last `0x3B` |
| JPEG | `FF D9` (EOI marker) | Scan backwards for last `FF D9` |
| PNG | End of IEND chunk | Find `IEND` chunk + 4-byte CRC |
| WebP | End of RIFF container | Read 4-byte LE size at offset 4 |

The V2 binary format appended after the image's end marker:

```
[Original image bytes, including end marker]
[MAGIC: "STEG_V2\0"]           ← 8 bytes, identifies our format
[FLAGS: 1 byte]                 ← bit 0: DEFLATE (legacy), bit 1: encrypted, bit 2: zstd
[ORIGINAL_SIZE: 4 bytes LE]     ← enables buffer pre-allocation on decode
[FILENAME_LEN: 2 bytes LE]      ← explicit length, not null-terminated
[FILENAME: N bytes UTF-8]
[DATA: raw bytes]               ← compressed, optionally encrypted
[END MARKER: "\0STEG_END"]     ← 8 bytes
```

All four formats tolerate trailing bytes — image viewers, browsers, and messaging apps ignore everything after the end marker and display the image normally. Extraction just searches for `STEG_V2\0` magic bytes regardless of carrier format.

Compared to V1 (Base64): a 1MB file used to become ~1.33MB of payload. Now it compresses to ~200-600KB of payload depending on content. That's a 2-6x improvement.

### Stage 4: Text Encoding (Base32768)

For sharing via text channels (messaging apps, chat, email), we encode the compressed (and optionally encrypted) payload into [Base32768](https://github.com/nicnacnic/base32768) — a Unicode encoding that packs 15 bits into each character.

This is where "why stop at 64" becomes concrete:

| Encoding | Bits/char | 1MB file becomes | Characters needed |
|----------|-----------|------------------|-------------------|
| Base64 | 6 | ~1.33M chars | 1,398,102 |
| Base85 | 6.4 | ~1.25M chars | 1,306,913 |
| Base32768 | 15 | ~546K chars | 559,241 |

Combined with Zstd compression, a 1MB text file that would need ~1.4 million Base64 characters can be represented in roughly **50,000-120,000 Base32768 characters** — a 12-28x reduction in character count.

### Why Not Base65536?

The obvious next question. Base65536 encodes 16 bits per character — one more bit than Base32768. But:

- **UTF-8 byte cost**: Base65536 uses astral plane characters (above U+FFFF). In UTF-8, these cost 4 bytes each. So you spend 4 bytes to store 2 bytes of data — worse than Base64. Base32768 stays in the Basic Multilingual Plane where characters are 2-3 bytes.
- **Surrogate pairs**: JavaScript strings are UTF-16. Characters above U+FFFF become surrogate pairs (two 16-bit code units). Many platforms — Windows clipboard, older Android, some chat backends — split, drop, or corrupt surrogates.
- **Platform mangling**: Discord, Slack, and some email clients normalize or strip characters from CJK Extension B and other astral blocks that Base65536 relies on.

The tradeoff is 6% fewer characters (16/15 bits) in exchange for significantly worse reliability. One corrupted character and the entire file is unrecoverable. Base32768 was specifically designed to use only Unicode blocks that empirically survive transit across real-world platforms.

### Stage 5: Error Correction (Reed-Solomon)

Even with Base32768's careful character selection, text shared through messaging apps can still get corrupted — an emoji autocorrect here, a smart-quote substitution there. A single wrong character used to mean total data loss. Now the text encoding pipeline includes [Reed-Solomon error correction](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction), the same algorithm used in QR codes, CDs, and deep-space communication.

The implementation operates over GF(2^8) (Galois Field with 256 elements) using the standard primitive polynomial 0x11d. Since a single RS codeword in GF(2^8) can be at most 255 bytes, larger payloads are automatically split into ≤223-byte blocks, each independently protected.

The number of parity symbols scales with payload size: ~3% overhead, with a minimum of 4 (corrects 2 byte errors per block) and a maximum of 32 (corrects 16 byte errors per block). For a typical 10KB compressed payload split across ~45 blocks, that means the system can recover from up to **~720 corrupted bytes** across the entire message — enough to survive most copy-paste mangling.

The text format stores a small header before the RS-encoded blocks:

```
[RS_NSYM: 1 byte]          ← parity symbols per block (4-32)
[ORIG_LEN: 4 bytes LE]     ← original payload length (for block boundary calculation)
[RS-encoded blocks]         ← each block is ≤223 data bytes + nsym parity bytes
```

The decoder uses the Berlekamp-Massey algorithm to find the error locator polynomial, Chien search to locate error positions, and the Forney algorithm to compute error magnitudes. If the corruption exceeds the correction capacity, it fails cleanly with a clear message rather than producing garbage.

Legacy text payloads (without RS) are still decoded correctly — the decoder tries RS first and falls back to raw deserialization.

### Why Not Just Raw Bytes Everywhere?

For the GIF embedding, raw bytes are optimal — there's no text constraint, so any encoding is pure overhead.

For text sharing, you *need* an encoding because the transport is text. You can't paste raw bytes into WhatsApp. The question is just which encoding, and Base32768 is the practical ceiling: maximum density within characters that survive real-world copy-paste.

## How to Use

### Hiding a file inside an image

1. Open the site at [http://localhost:3000](http://localhost:3000).
2. Browse the image collection and find one you like. The collection includes GIFs, PNGs, JPEGs, and WebPs.
3. **Triple-click the top-left corner** of any image card (within the first 40x40 pixels). This is intentionally hidden — there's no visible button.
4. The **Attach** modal opens.
5. Click the file input and select any file you want to hide. A **capacity indicator** will show the file size and estimated compressed payload size so you know what to expect before encoding.
6. **(Optional)** Enter a password in the password field. If provided, the file will be encrypted with AES-256-GCM before embedding. Leave it blank for no encryption.
7. Click **Download**. The image will download to your computer with the file hidden inside. It still looks and works like a normal image — image viewers, browsers, and messaging apps will display it normally.
8. **(Optional)** After encoding completes, click **Generate text version** to produce a Base32768 Unicode string of the same file. Click **Copy** to copy it to your clipboard for sharing via text channels. This step is on-demand to keep the initial encode fast.
9. **(Optional)** For small payloads (under ~1200 characters of text output), a **Generate QR code** button appears below the text. Click it to produce a scannable QR code containing the encoded data. The recipient scans it and pastes the result into the Paste Text tab to decode.

### Extracting a hidden file from an image

1. Scroll down to the feature badges section on the site.
2. Find the **"Safe & Secure"** badge (fourth badge) and **triple-click** it. This opens the **Extract** modal.
3. You'll see two tabs: **Image File** and **Paste Text**.

**From an image file:**
1. Select the **Image File** tab (default).
2. Either drag and drop an image into the modal, or click **Choose File** to select one. Supports GIF, PNG, JPEG, and WebP.
3. If the image has no hidden data, you'll see "Nothing here."
4. If the image has hidden data and it's **not encrypted**, the hidden file downloads automatically.
5. If the image has hidden data and it **is encrypted**, a password prompt appears. Enter the password that was used during encoding and click **Decrypt**. If the password is wrong, you'll see an error — AES-GCM doesn't silently produce garbage, it fails cleanly.

**From pasted text:**
1. Select the **Paste Text** tab.
2. Paste the Base32768 Unicode string you received into the text area.
3. Click **Decode**.
4. If the text is encrypted, a password prompt appears. Enter the password and click **Decrypt**.
5. The original file downloads automatically.

### Sharing a hidden file

**Via image:** Send the downloaded image through any channel — email, messaging apps, social media, cloud storage. The image will display normally everywhere. The recipient just needs to visit this site and use the extract flow above.

**Via text:** Copy the Base32768 text output and paste it into any text channel — Teams, WhatsApp, Discord, email. The recipient pastes it into the Paste Text tab on the extract modal. Note: this works best for smaller files, as large files produce very long strings.

**Via QR code:** For very small files (compressed payload under ~2KB), generate a QR code from the text output. Share it as an image — screenshot, photo, print. The recipient scans the QR code with any scanner app, then pastes the scanned text into the Paste Text tab to decode. This is useful for sharing small secrets (passwords, keys, short messages) without any digital trail.

## The Architecture

Everything is modular. Each concern lives in its own file and can be improved or replaced independently:

```
src/lib/stego/
  index.ts          ← Public API: encode, decode, encodeToText, decodeFromText
  types.ts          ← Constants (magic bytes, flags) and shared types
  compression.ts    ← compress/decompress — Zstd via WASM, with DEFLATE fallback for legacy
  encryption.ts     ← encrypt/decrypt — AES-256-GCM via Web Crypto API
  embed.ts          ← Multi-format image embedding — GIF, PNG, JPEG, WebP
  format.ts         ← Binary format serialization — header layout, versioning
  reed-solomon.ts   ← Reed-Solomon error correction — GF(2^8), multi-block
  textcodec.ts      ← Unicode text encoding — Base32768 + RS error correction
  worker.ts         ← Web Worker — runs all pipeline stages off the main thread
  client.ts         ← Main-thread client — same API as index.ts, delegates to worker
```

All stego operations (compression, encryption, embedding, text encoding) run in a **Web Worker**, keeping the main thread and UI fully responsive even for large files. The worker is lazily spawned on first use and communicates via `postMessage`, with `Uint8Array` buffers transferred zero-copy. Progress stage callbacks are forwarded from the worker to the main thread so the progress bar updates in real time.

Want better compression? Replace `compression.ts`. Want a different text encoding? Replace `textcodec.ts`. Want to support more image formats? Add a new end-marker finder to `embed.ts`. Want a different encryption scheme? Replace `encryption.ts`. Want a different error correction code? Replace `reed-solomon.ts`. Nothing else changes.

The decoder is backward-compatible: V1 (legacy Base64) GIFs and V2 DEFLATE-compressed GIFs still decode correctly alongside new Zstd-compressed payloads. All four carrier formats (GIF, PNG, JPEG, WebP) use the same payload format.

## What We Could Still Do

- **Chunked progress**: The progress bar currently jumps between pipeline stages because zstd compress/decompress is a single synchronous WASM call. Splitting large files into chunks and compressing each individually would allow reporting real percentage progress — more honest UX for multi-MB files.
- **Multi-file support**: Tar-like bundling before compression — hide a whole folder in one image. The format already has a filename field; you'd just need a file-count header and repeat the name+data blocks.
- **Plausible deniability**: The `STEG_V2\0` magic bytes are a dead giveaway if someone looks at the hex. Encrypting the entire payload including the header would make it indistinguishable from random trailing bytes without the password.
- **Streaming**: For very large files, streaming compression would reduce peak memory usage.

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Images are auto-discovered from `public/gifs/`. Add or remove `.gif`, `.png`, `.jpg`, `.jpeg`, or `.webp` files to change the collection.

## Tech Stack

- **Next.js 16** (App Router)
- **Tailwind CSS v4**
- **@bokuweb/zstd-wasm** (Zstandard compression via WebAssembly)
- **fflate** (DEFLATE decompression for legacy payloads)
- **base32768** (Unicode text encoding)
- **qrcode** (QR code generation for small payloads)
- **Web Crypto API** (AES-256-GCM encryption, PBKDF2 key derivation)
- **TypeScript**, custom Reed-Solomon implementation (no external dependency)

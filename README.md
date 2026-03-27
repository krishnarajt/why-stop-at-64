# Why Stop at 64?

A curated collection of exactly 64 GIFs with a hidden steganography system that lets you compress, optionally encrypt, and hide arbitrary files inside GIF images — then share them as plain text.

The name isn't about 64 GIFs. It's about **Base64**, and why we decided not to stop there.

---

## The Question

Base64 is everywhere. It's how the internet encodes binary data into text — email attachments, data URIs, API payloads. It takes every 3 bytes of data and maps them to 4 printable ASCII characters. Simple, universal, and wasteful: a 33% size overhead on everything it touches.

So we asked: why stop at 64?

## Encoding vs. Compression

These are fundamentally different operations, and confusing them is the root of most misconceptions about "higher bases."

**Encoding** is a representation change. You're expressing the same information using a different alphabet. Base64 uses 64 characters (A-Z, a-z, 0-9, +, /), encoding 6 bits per character. Base85 uses 85 characters, encoding ~6.4 bits. Base32768 uses 32,768 Unicode characters, encoding 15 bits per character. No matter the base, encoding can never make data smaller in terms of information — it can only change how many characters you need. The byte count may even go *up* depending on how those characters are stored (more on this below).

**Compression** actually removes data — specifically, redundancy. Real files aren't random noise. Text has predictable letter frequencies. Images have regions of similar color. Code repeats patterns. Compression algorithms like DEFLATE exploit this:

1. **Dictionary substitution** (LZ77): Find repeated byte sequences, store them once, reference them everywhere else. The word "the" appears 50 times? Store it once, emit 49 tiny back-references.
2. **Entropy coding** (Huffman): Give frequent bytes short bit patterns and rare bytes long ones. Same idea as Morse code — "E" is a single dot because it's the most common letter.

The theoretical floor is Shannon entropy: the minimum bits required to represent the actual information content. A file of all zeros compresses to nearly nothing. A truly random file can't be compressed at all.

## What We Did

We built a four-stage pipeline, each stage modular and independently replaceable:

### Stage 1: Compression (DEFLATE, level 9)

Before doing anything else, we compress the file using DEFLATE at maximum compression (level 9) via [fflate](https://github.com/101arrowz/fflate). This is the same algorithm behind ZIP and gzip — well-understood, lossless, and the best general-purpose ratio available in a browser without WASM. Typical files shrink 40-80%.

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

### Stage 3: Binary Embedding (Raw Bytes in GIF)

The original implementation used Base64 to encode data before hiding it in the GIF. This was unnecessary. A GIF is a binary file — every byte position after the GIF trailer (0x3B) can hold any value from 0x00 to 0xFF. There's no text-safety constraint. Encoding to Base64 was inflating the payload by 33% for zero benefit.

We dropped Base64 entirely and store raw compressed (and optionally encrypted) bytes directly. The V2 binary format:

```
[Original GIF bytes, including 0x3B trailer]
[MAGIC: "STEG_V2\0"]           ← 8 bytes, identifies our format
[FLAGS: 1 byte]                 ← bit 0: compressed, bit 1: encrypted
[ORIGINAL_SIZE: 4 bytes LE]     ← enables buffer pre-allocation on decode
[FILENAME_LEN: 2 bytes LE]      ← explicit length, not null-terminated
[FILENAME: N bytes UTF-8]
[DATA: raw bytes]               ← compressed, optionally encrypted
[END MARKER: "\0STEG_END"]     ← 8 bytes
```

Compared to V1 (Base64): a 1MB file used to become ~1.33MB of payload. Now it compresses to ~200-600KB of payload depending on content. That's a 2-6x improvement.

### Stage 4: Text Encoding (Base32768)

For sharing via text channels (messaging apps, chat, email), we encode the compressed (and optionally encrypted) payload into [Base32768](https://github.com/nicnacnic/base32768) — a Unicode encoding that packs 15 bits into each character.

This is where "why stop at 64" becomes concrete:

| Encoding | Bits/char | 1MB file becomes | Characters needed |
|----------|-----------|------------------|-------------------|
| Base64 | 6 | ~1.33M chars | 1,398,102 |
| Base85 | 6.4 | ~1.25M chars | 1,306,913 |
| Base32768 | 15 | ~546K chars | 559,241 |

Combined with DEFLATE compression, a 1MB text file that would need ~1.4 million Base64 characters can be represented in roughly **70,000-140,000 Base32768 characters** — a 10-20x reduction in character count.

### Why Not Base65536?

The obvious next question. Base65536 encodes 16 bits per character — one more bit than Base32768. But:

- **UTF-8 byte cost**: Base65536 uses astral plane characters (above U+FFFF). In UTF-8, these cost 4 bytes each. So you spend 4 bytes to store 2 bytes of data — worse than Base64. Base32768 stays in the Basic Multilingual Plane where characters are 2-3 bytes.
- **Surrogate pairs**: JavaScript strings are UTF-16. Characters above U+FFFF become surrogate pairs (two 16-bit code units). Many platforms — Windows clipboard, older Android, some chat backends — split, drop, or corrupt surrogates.
- **Platform mangling**: Discord, Slack, and some email clients normalize or strip characters from CJK Extension B and other astral blocks that Base65536 relies on.

The tradeoff is 6% fewer characters (16/15 bits) in exchange for significantly worse reliability. One corrupted character and the entire file is unrecoverable. Base32768 was specifically designed to use only Unicode blocks that empirically survive transit across real-world platforms.

### Why Not Just Raw Bytes Everywhere?

For the GIF embedding, raw bytes are optimal — there's no text constraint, so any encoding is pure overhead.

For text sharing, you *need* an encoding because the transport is text. You can't paste raw bytes into WhatsApp. The question is just which encoding, and Base32768 is the practical ceiling: maximum density within characters that survive real-world copy-paste.

## How to Use

### Hiding a file inside a GIF

1. Open the site at [http://localhost:3000](http://localhost:3000).
2. Browse the GIF collection and find one you like.
3. **Triple-click the top-left corner** of any GIF card (within the first 40x40 pixels). This is intentionally hidden — there's no visible button.
4. The **Attach** modal opens.
5. Click the file input and select any file you want to hide.
6. **(Optional)** Enter a password in the password field. If provided, the file will be encrypted with AES-256-GCM before embedding. Leave it blank for no encryption.
7. Click **Download**. The GIF will download to your computer with the file hidden inside. It still looks and works like a normal GIF — image viewers, browsers, and messaging apps will display it normally.
8. After encoding completes, a **Text version** appears at the bottom of the modal. This is the same file encoded as a Base32768 Unicode string. Click **Copy** to copy it to your clipboard for sharing via text channels.

### Extracting a hidden file from a GIF

1. Scroll down to the feature badges section on the site.
2. Find the **"Safe & Secure"** badge (fourth badge) and **triple-click** it. This opens the **Extract** modal.
3. You'll see two tabs: **GIF File** and **Paste Text**.

**From a GIF file:**
1. Select the **GIF File** tab (default).
2. Either drag and drop a GIF into the modal, or click **Choose File** to select one.
3. If the GIF has no hidden data, you'll see "Nothing here."
4. If the GIF has hidden data and it's **not encrypted**, the hidden file downloads automatically.
5. If the GIF has hidden data and it **is encrypted**, a password prompt appears. Enter the password that was used during encoding and click **Decrypt**. If the password is wrong, you'll see an error — AES-GCM doesn't silently produce garbage, it fails cleanly.

**From pasted text:**
1. Select the **Paste Text** tab.
2. Paste the Base32768 Unicode string you received into the text area.
3. Click **Decode**.
4. If the text is encrypted, a password prompt appears. Enter the password and click **Decrypt**.
5. The original file downloads automatically.

### Sharing a hidden file

**Via GIF:** Send the downloaded GIF through any channel — email, messaging apps, social media, cloud storage. The GIF will display and play normally everywhere. The recipient just needs to visit this site and use the extract flow above.

**Via text:** Copy the Base32768 text output and paste it into any text channel — Teams, WhatsApp, Discord, email. The recipient pastes it into the Paste Text tab on the extract modal. Note: this works best for smaller files, as large files produce very long strings.

## The Architecture

Everything is modular. Each concern lives in its own file and can be improved or replaced independently:

```
src/lib/stego/
  index.ts          ← Public API: encode, decode, encodeToText, decodeFromText
  types.ts          ← Constants (magic bytes, flags) and shared types
  compression.ts    ← compress/decompress — swap DEFLATE for Brotli, zstd, etc.
  encryption.ts     ← encrypt/decrypt — AES-256-GCM via Web Crypto API
  embed.ts          ← GIF binary embedding — find trailer, insert/extract payload
  format.ts         ← Binary format serialization — header layout, versioning
  textcodec.ts      ← Unicode text encoding — swap Base32768 for anything
```

Want better compression? Replace `compression.ts`. Want a different text encoding? Replace `textcodec.ts`. Want to embed in PNGs instead of GIFs? Replace `embed.ts`. Want a different encryption scheme? Replace `encryption.ts`. Nothing else changes.

The decoder is backward-compatible: V1 (legacy Base64) GIFs still decode correctly alongside V2.

## What We Could Still Do

- **Brotli or zstd compression**: Higher ratios than DEFLATE, but require WASM in the browser. A drop-in replacement in `compression.ts`.
- **Web Worker offloading**: DEFLATE level 9 is synchronous and blocks the main thread. For files over ~10MB, moving compression to a Worker would keep the UI responsive. The module boundary is already clean for this.
- **Error correction**: Append a CRC32 or Reed-Solomon checksum to the text encoding so corrupted pastes can be detected (or even recovered).
- **Streaming**: fflate supports streaming compression for very large files, which would reduce memory usage.

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

GIFs are auto-discovered from `public/gifs/`. Add or remove `.gif` files to change the collection.

## Tech Stack

- **Next.js 16** (App Router)
- **Tailwind CSS v4**
- **fflate** (DEFLATE compression)
- **base32768** (Unicode text encoding)
- **Web Crypto API** (AES-256-GCM encryption, PBKDF2 key derivation)
- **TypeScript**, no additional runtime dependencies for encryption

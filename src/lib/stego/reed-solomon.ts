/**
 * Reed-Solomon error correction over GF(2^8).
 * Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1 (0x11d).
 * Generator roots: alpha^0, alpha^1, ..., alpha^(nsym-1) where alpha=2.
 *
 * Max codeword length in GF(2^8) is 255 bytes. For larger data,
 * we automatically split into blocks and encode each independently.
 *
 * Appends `nsym` parity symbols per block.
 * Corrects up to floor(nsym/2) symbol errors per block.
 */

// --- GF(2^8) lookup tables ---

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function gfInverse(a: number): number {
  if (a === 0) throw new Error("GF inverse of zero");
  return GF_EXP[255 - GF_LOG[a]];
}

// --- Polynomials as number arrays, index 0 = highest degree ---

function polyMul(a: number[], b: number[]): number[] {
  const r = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      r[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return r;
}

function polyEval(p: number[], x: number): number {
  let y = p[0];
  for (let i = 1; i < p.length; i++) {
    y = gfMul(y, x) ^ p[i];
  }
  return y;
}

// --- RS generator polynomial ---

function rsGenerator(nsym: number): number[] {
  let g = [1];
  for (let i = 0; i < nsym; i++) {
    g = polyMul(g, [1, GF_EXP[i]]);
  }
  return g;
}

// --- Single-block encode/decode (max 255 bytes total) ---

function rsEncodeBlock(data: number[], nsym: number): number[] {
  const gen = rsGenerator(nsym);
  const msg = new Array(data.length + nsym).fill(0);
  for (let i = 0; i < data.length; i++) msg[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  const result = [...data];
  for (let i = 0; i < nsym; i++) {
    result.push(msg[data.length + i]);
  }
  return result;
}

function calcSyndromes(msg: number[], nsym: number): number[] {
  const synd = new Array(nsym);
  for (let i = 0; i < nsym; i++) {
    synd[i] = polyEval(msg, GF_EXP[i]);
  }
  return synd;
}

function berlekampMassey(synd: number[], nsym: number): number[] {
  const C = new Array(nsym + 1).fill(0);
  const B = new Array(nsym + 1).fill(0);
  C[0] = 1;
  B[0] = 1;
  let L = 0;
  let m = 1;

  for (let n = 0; n < nsym; n++) {
    let d = synd[n];
    for (let i = 1; i <= L; i++) {
      d ^= gfMul(C[i], synd[n - i]);
    }

    if (d === 0) {
      m++;
    } else {
      const T = [...C];
      const dInv = gfInverse(d);
      for (let i = m; i < nsym + 1; i++) {
        if (B[i - m] !== 0) {
          C[i] ^= gfMul(d, B[i - m]);
        }
      }
      if (2 * L <= n) {
        L = n + 1 - L;
        for (let i = 0; i < nsym + 1; i++) {
          B[i] = gfMul(T[i], dInv);
        }
        m = 1;
      } else {
        m++;
      }
    }
  }

  const sigma = new Array(L + 1);
  for (let i = 0; i <= L; i++) {
    sigma[L - i] = C[i];
  }

  if (L > Math.floor(nsym / 2)) {
    throw new Error("Too many errors to correct");
  }

  return sigma;
}

function chienSearch(sigma: number[], msgLen: number): number[] {
  const numErrors = sigma.length - 1;
  const positions: number[] = [];

  for (let j = 0; j < msgLen; j++) {
    const x = GF_EXP[(255 - j) % 255]; // alpha^(-j)
    if (polyEval(sigma, x) === 0) {
      positions.push(msgLen - 1 - j); // convert power position to array index
    }
  }

  if (positions.length !== numErrors) {
    throw new Error("Could not locate all errors");
  }

  return positions;
}

function forney(
  synd: number[],
  sigma: number[],
  positions: number[],
  msgLen: number
): Map<number, number> {
  const nsym = synd.length;

  // Syndrome polynomial S(x) in highest-degree-first form
  const sPoly = new Array(nsym);
  for (let i = 0; i < nsym; i++) {
    sPoly[nsym - 1 - i] = synd[i];
  }

  // Omega(x) = S(x) * sigma(x), keep only low-degree terms (mod x^nsym)
  const raw = polyMul(sPoly, sigma);
  const omega = raw.slice(raw.length - nsym);

  const magnitudes = new Map<number, number>();

  for (const pos of positions) {
    const j = msgLen - 1 - pos; // power position
    const xiInv = GF_EXP[(255 - j) % 255]; // alpha^(-j)
    const xi = GF_EXP[j % 255]; // alpha^j

    const omegaVal = polyEval(omega, xiInv);

    // Evaluate formal derivative sigma'(alpha^(-j))
    let spVal = 0;
    for (let k = 1; k < sigma.length; k += 2) {
      const coef = sigma[sigma.length - 1 - k]; // coefficient of x^k
      const xpow = k - 1 === 0 ? 1 : GF_EXP[(GF_LOG[xiInv] * (k - 1)) % 255];
      spVal ^= gfMul(coef, xpow);
    }

    if (spVal === 0) {
      throw new Error("Forney: sigma' evaluated to zero");
    }

    magnitudes.set(pos, gfMul(xi, gfMul(omegaVal, gfInverse(spVal))));
  }

  return magnitudes;
}

function rsDecodeBlock(msg: number[], nsym: number): number[] {
  const synd = calcSyndromes(msg, nsym);

  if (synd.every((s) => s === 0)) {
    return msg.slice(0, msg.length - nsym);
  }

  const sigma = berlekampMassey(synd, nsym);
  const positions = chienSearch(sigma, msg.length);
  const magnitudes = forney(synd, sigma, positions, msg.length);

  const corrected = [...msg];
  for (const [pos, mag] of magnitudes) {
    corrected[pos] ^= mag;
  }

  const checkSynd = calcSyndromes(corrected, nsym);
  if (checkSynd.some((s) => s !== 0)) {
    throw new Error("Reed-Solomon correction failed — too many errors");
  }

  return corrected.slice(0, corrected.length - nsym);
}

// --- Public API: multi-block encode/decode ---

const MAX_BLOCK_DATA = 223; // 255 - max nsym (32), conservative safe limit

/**
 * Encode: split data into blocks, RS-encode each, concatenate.
 */
export function rsEncode(data: Uint8Array, nsym: number): Uint8Array<ArrayBuffer> {
  const blockDataSize = Math.min(MAX_BLOCK_DATA, 255 - nsym);
  const numBlocks = Math.ceil(data.length / blockDataSize);
  const outputParts: number[][] = [];

  for (let b = 0; b < numBlocks; b++) {
    const start = b * blockDataSize;
    const end = Math.min(start + blockDataSize, data.length);
    const block = Array.from(data.subarray(start, end));
    outputParts.push(rsEncodeBlock(block, nsym));
  }

  const totalLen = outputParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of outputParts) {
    for (let i = 0; i < part.length; i++) result[offset++] = part[i];
  }
  return result;
}

/**
 * Decode: split into blocks (data+parity each), RS-decode each, concatenate.
 */
export function rsDecode(msg: Uint8Array, nsym: number, originalLen: number): Uint8Array<ArrayBuffer> {
  const blockDataSize = Math.min(MAX_BLOCK_DATA, 255 - nsym);
  const blockTotalSize = blockDataSize + nsym;
  const numFullBlocks = Math.floor(originalLen / blockDataSize);
  const lastBlockData = originalLen % blockDataSize;
  const numBlocks = lastBlockData > 0 ? numFullBlocks + 1 : numFullBlocks;

  const outputParts: number[][] = [];
  let offset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const isLast = b === numBlocks - 1 && lastBlockData > 0;
    const thisBlockTotal = isLast ? lastBlockData + nsym : blockTotalSize;
    const block = Array.from(msg.subarray(offset, offset + thisBlockTotal));
    offset += thisBlockTotal;
    outputParts.push(rsDecodeBlock(block, nsym));
  }

  const totalLen = outputParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let rOffset = 0;
  for (const part of outputParts) {
    for (let i = 0; i < part.length; i++) result[rOffset++] = part[i];
  }
  return result;
}

/**
 * Number of RS parity symbols for a given data length.
 * ~3% overhead, min 4 (corrects 2 errors/block), max 32 (corrects 16 errors/block).
 */
export function rsSymbolCount(dataLen: number): number {
  const nsym = Math.max(4, Math.min(32, Math.ceil(dataLen * 0.03)));
  return nsym % 2 === 0 ? nsym : nsym + 1;
}

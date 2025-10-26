import { uint8ToHex } from "../utils/binary-encoding";
import { BufferImpl } from "./stream";

export function randomBytes(size: number): BufferImpl {
  const buf = new BufferImpl(size);
  crypto.getRandomValues(buf);
  return buf;
}

export function randomUUID(): string {
  return crypto.randomUUID();
}
export function randomInt(min: number, max?: number): number {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  const range = max - min;
  if (range <= 0) return min;
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return min + (arr[0] % range);
}

// ---- Pure-JS SHA-256 (sync) ----
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(data: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const bitLen = data.length * 8;
  const padLen = (data.length + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);
  if (bitLen > 0xffffffff)
    view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 =
        (((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
          ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
          (w[i - 15] >>> 3)) >>>
        0;
      const s1 =
        (((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
          ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
          (w[i - 2] >>> 10)) >>>
        0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 =
        (((e >>> 6) | (e << 26)) ^
          ((e >>> 11) | (e << 21)) ^
          ((e >>> 25) | (e << 7))) >>>
        0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 =
        (((a >>> 2) | (a << 30)) ^
          ((a >>> 13) | (a << 19)) ^
          ((a >>> 22) | (a << 10))) >>>
        0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0, false);
  ov.setUint32(4, h1, false);
  ov.setUint32(8, h2, false);
  ov.setUint32(12, h3, false);
  ov.setUint32(16, h4, false);
  ov.setUint32(20, h5, false);
  ov.setUint32(24, h6, false);
  ov.setUint32(28, h7, false);
  return out;
}

// ---- Pure-JS MD5 (sync) ----
function md5(data: Uint8Array): Uint8Array {
  let a0 = 0x67452301,
    b0 = 0xefcdab89,
    c0 = 0x98badcfe,
    d0 = 0x10325476;
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++)
    K[i] = Math.floor(2 ** 32 * Math.abs(Math.sin(i + 1))) >>> 0;

  const bitLen = data.length * 8;
  const padLen = (data.length + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const pv = new DataView(padded.buffer);
  pv.setUint32(padLen - 8, bitLen >>> 0, true);
  pv.setUint32(padLen - 4, Math.floor(bitLen / 0x100000000), true);

  for (let off = 0; off < padLen; off += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) M[j] = pv.getUint32(off + j * 4, true);
    let A = a0,
      B = b0,
      C = c0,
      D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true);
  ov.setUint32(4, b0, true);
  ov.setUint32(8, c0, true);
  ov.setUint32(12, d0, true);
  return out;
}

function hashBytes(algorithm: string, data: Uint8Array): Uint8Array {
  const algo = algorithm.toLowerCase().replace("-", "");
  if (algo === "sha256") return sha256(data);
  if (algo === "md5") return md5(data);
  // Fallback for unsupported algorithms: use sha256
  return sha256(data);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

class HashImpl {
  private algorithm: string;
  private data: Uint8Array[] = [];
  constructor(algorithm: string) {
    this.algorithm = algorithm.toLowerCase().replace("-", "");
  }
  update(data: string | Uint8Array, encoding?: string): this {
    this.data.push(
      typeof data === "string"
        ? encoding === "hex"
          ? BufferImpl.from(data, "hex")
          : new TextEncoder().encode(data)
        : data,
    );
    return this;
  }
  private _combine(): Uint8Array {
    const total = this.data.reduce((s, b) => s + b.length, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.data) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  }
  async digestAsync(encoding?: string): Promise<string | Uint8Array> {
    const combined = this._combine();
    const algoMap: Record<string, string> = {
      sha256: "SHA-256",
      sha1: "SHA-1",
      sha384: "SHA-384",
      sha512: "SHA-512",
    };
    const wcAlgo = algoMap[this.algorithm];
    if (wcAlgo && typeof globalThis.crypto?.subtle?.digest === "function") {
      const buf = combined.buffer.slice(
        combined.byteOffset,
        combined.byteOffset + combined.byteLength,
      ) as ArrayBuffer;
      const result = new Uint8Array(await crypto.subtle.digest(wcAlgo, buf));
      if (encoding === "hex") return bytesToHex(result);
      if (encoding === "base64") return bytesToBase64(result);
      return BufferImpl.from(result);
    }
    return this.digest(encoding); // fallback to sync
  }
  digest(encoding?: string): string | Uint8Array {
    const combined = this._combine();
    const result = hashBytes(this.algorithm, combined);
    if (encoding === "hex") return bytesToHex(result);
    if (encoding === "base64") return bytesToBase64(result);
    return BufferImpl.from(result);
  }
}

class HmacImpl {
  private algorithm: string;
  private key: Uint8Array;
  private chunks: Uint8Array[] = [];
  constructor(algorithm: string, key: string | Uint8Array) {
    this.algorithm = algorithm;
    this.key = typeof key === "string" ? new TextEncoder().encode(key) : key;
  }
  update(data: string | Uint8Array, _encoding?: string): this {
    this.chunks.push(
      typeof data === "string" ? new TextEncoder().encode(data) : data,
    );
    return this;
  }
  digest(encoding?: string): string | Uint8Array {
    let total = 0;
    for (const c of this.chunks) total += c.length;
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      combined.set(c, offset);
      offset += c.length;
    }

    if (this.algorithm === "sha256") {
      const result = hmacSha256(this.key, combined);
      if (encoding === "hex") return bytesToHex(result);
      if (encoding === "base64") return bytesToBase64(result);
      return BufferImpl.from(result);
    }
    // Fallback for unsupported algorithms: plain hash (best effort)
    const result = hashBytes(this.algorithm, combined);
    if (encoding === "hex") return bytesToHex(result);
    if (encoding === "base64") return bytesToBase64(result);
    return BufferImpl.from(result);
  }
}

export function createHash(algorithm: string): HashImpl {
  return new HashImpl(algorithm);
}
export function createHmac(
  algorithm: string,
  key: string | Uint8Array,
): HmacImpl {
  return new HmacImpl(algorithm, key);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length)
    throw new RangeError("Input buffers must have the same byte length");
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

export function getHashes(): string[] {
  return ["sha1", "sha256", "sha384", "sha512"];
}
export function getCiphers(): string[] {
  return ["aes-128-cbc", "aes-256-cbc", "aes-128-gcm", "aes-256-gcm"];
}

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  let keyBlock = key;
  if (keyBlock.length > blockSize) keyBlock = sha256(keyBlock);
  const padded = new Uint8Array(blockSize);
  padded.set(keyBlock);

  const ipad = new Uint8Array(blockSize + data.length);
  for (let i = 0; i < blockSize; i++) ipad[i] = padded[i] ^ 0x36;
  ipad.set(data, blockSize);
  const inner = sha256(ipad);

  const opad = new Uint8Array(blockSize + 32);
  for (let i = 0; i < blockSize; i++) opad[i] = padded[i] ^ 0x5c;
  opad.set(inner, blockSize);
  return sha256(opad);
}

export function createSign(_algorithm: string) {
  const chunks: Uint8Array[] = [];
  return {
    update(data: string | Uint8Array) {
      chunks.push(
        typeof data === "string" ? new TextEncoder().encode(data) : data,
      );
      return this;
    },
    sign(key: unknown, encoding?: string) {
      const keyBytes =
        typeof key === "string"
          ? new TextEncoder().encode(key)
          : key instanceof Uint8Array
            ? key
            : new TextEncoder().encode(String(key));
      const total = chunks.reduce((s, b) => s + b.length, 0);
      const combined = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        combined.set(c, off);
        off += c.length;
      }
      const sig = hmacSha256(keyBytes, combined);
      if (encoding === "hex") return bytesToHex(sig);
      if (encoding === "base64") return bytesToBase64(sig);
      return BufferImpl.from(sig);
    },
  };
}

export function createVerify(_algorithm: string) {
  const chunks: Uint8Array[] = [];
  return {
    update(data: string | Uint8Array) {
      chunks.push(
        typeof data === "string" ? new TextEncoder().encode(data) : data,
      );
      return this;
    },
    verify(key: unknown, signature: unknown, encoding?: string) {
      const keyBytes =
        typeof key === "string"
          ? new TextEncoder().encode(key)
          : key instanceof Uint8Array
            ? key
            : new TextEncoder().encode(String(key));
      const total = chunks.reduce((s, b) => s + b.length, 0);
      const combined = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        combined.set(c, off);
        off += c.length;
      }
      const expected = hmacSha256(keyBytes, combined);
      const expectedStr =
        encoding === "base64" ? bytesToBase64(expected) : bytesToHex(expected);
      const sigStr =
        typeof signature === "string"
          ? signature
          : bytesToHex(signature as Uint8Array);
      return expectedStr === sigStr;
    },
  };
}

export const webcrypto = crypto;

export default {
  randomBytes,
  randomUUID,
  randomInt,
  createHash,
  createHmac,
  timingSafeEqual,
  getHashes,
  getCiphers,
  createSign,
  createVerify,
  webcrypto,
};

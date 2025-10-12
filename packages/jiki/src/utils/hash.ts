/**
 * FNV-1a hash producing a 64-bit result (two 32-bit halves).
 * Returns base36 string (~12 chars). Much lower collision probability
 * than the previous 32-bit djb2 (~6 chars).
 */
export function simpleHash(str: string): string {
  // FNV-1a 64-bit offset basis and prime (split into high/low 32-bit)
  let h0 = 0x811c9dc5; // low 32 bits of offset basis
  let h1 = 0xcbf29ce4; // high 32 bits of offset basis

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    // XOR with byte
    h0 ^= c;
    // Multiply by FNV prime 0x00000100000001B3
    // Using schoolbook multiplication for two 32-bit halves
    const lo = Math.imul(h0, 0x01b3) >>> 0;
    const hi = (Math.imul(h1, 0x01b3) + Math.imul(h0, 0x0100)) >>> 0;
    h0 = lo;
    h1 = hi;
  }

  return (h1 >>> 0).toString(36) + (h0 >>> 0).toString(36);
}

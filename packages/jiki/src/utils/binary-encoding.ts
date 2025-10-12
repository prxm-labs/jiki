const CHUNK = 8192;

export function uint8ToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(
      String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK))),
    );
  }
  return btoa(parts.join(""));
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ToHex(bytes: Uint8Array): string {
  const hex = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hex[i] = bytes[i].toString(16).padStart(2, "0");
  }
  return hex.join("");
}

export function uint8ToBinaryString(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(
      String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK))),
    );
  }
  return parts.join("");
}

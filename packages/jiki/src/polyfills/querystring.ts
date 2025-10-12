export function stringify(
  obj: Record<string, unknown>,
  sep = "&",
  eq = "=",
): string {
  if (!obj) return "";
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (Array.isArray(v))
        return v
          .map(
            item =>
              encodeURIComponent(k) + eq + encodeURIComponent(String(item)),
          )
          .join(sep);
      return encodeURIComponent(k) + eq + encodeURIComponent(String(v));
    })
    .join(sep);
}

export function parse(
  str: string,
  sep = "&",
  eq = "=",
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  if (!str) return result;
  for (const part of str.split(sep)) {
    const idx = part.indexOf(eq);
    const key = decodeURIComponent(idx >= 0 ? part.slice(0, idx) : part);
    const value =
      idx >= 0 ? decodeURIComponent(part.slice(idx + eq.length)) : "";
    if (key in result) {
      const existing = result[key];
      if (Array.isArray(existing)) existing.push(value);
      else result[key] = [existing, value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function escape(str: string): string {
  return encodeURIComponent(str);
}
export function unescape(str: string): string {
  return decodeURIComponent(str.replace(/\+/g, " "));
}
export function encode(
  obj: Record<string, unknown>,
  sep?: string,
  eq?: string,
): string {
  return stringify(obj, sep, eq);
}
export function decode(
  str: string,
  sep?: string,
  eq?: string,
): Record<string, string | string[]> {
  return parse(str, sep, eq);
}

export default { stringify, parse, escape, unescape, encode, decode };

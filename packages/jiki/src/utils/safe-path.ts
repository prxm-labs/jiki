import { posix } from "../polyfills/path";

/**
 * Resolve a URL path safely within a root directory.
 * Strips query/hash, decodes, normalizes, and ensures the result
 * never escapes outside root via .. traversal.
 */
export function safePath(root: string, urlPath: string): string {
  // Strip query string and hash
  let p = urlPath.split("?")[0].split("#")[0];

  // Decode percent-encoded characters
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep as-is */
  }

  // Ensure leading slash
  if (!p.startsWith("/")) p = "/" + p;

  // Normalize (resolves .., ., double slashes)
  p = posix.normalize(p);

  // Join with root
  const full = root === "/" ? p : posix.normalize(root + "/" + p);

  // Verify the result starts with root
  const normalRoot = root === "/" ? "/" : posix.normalize(root);
  if (
    !full.startsWith(normalRoot === "/" ? "/" : normalRoot + "/") &&
    full !== normalRoot
  ) {
    return normalRoot;
  }

  return full;
}

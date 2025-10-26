export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;

export function parse(
  urlString: string,
  parseQueryString = false,
  slashesDenoteHost = false,
): Record<string, unknown> {
  try {
    const parsed = new globalThis.URL(urlString, "http://localhost");
    const result: Record<string, unknown> = {
      protocol: parsed.protocol,
      slashes: parsed.protocol ? true : null,
      auth: parsed.username
        ? parsed.password
          ? `${parsed.username}:${parsed.password}`
          : parsed.username
        : null,
      host: parsed.host,
      port: parsed.port || null,
      hostname: parsed.hostname,
      hash: parsed.hash || null,
      search: parsed.search || null,
      query: parseQueryString
        ? Object.fromEntries(parsed.searchParams)
        : parsed.search?.slice(1) || null,
      pathname: parsed.pathname,
      path: parsed.pathname + (parsed.search || ""),
      href: parsed.href,
    };
    return result;
  } catch {
    return {
      protocol: null,
      slashes: null,
      auth: null,
      host: null,
      port: null,
      hostname: null,
      hash: null,
      search: null,
      query: null,
      pathname: urlString,
      path: urlString,
      href: urlString,
    };
  }
}

export function format(urlObj: Record<string, unknown>): string {
  if (typeof urlObj === "string") return urlObj;
  let result = "";
  if (urlObj.protocol) result += urlObj.protocol;
  if (urlObj.slashes) result += "//";
  if (urlObj.auth) result += urlObj.auth + "@";
  if (urlObj.hostname) result += urlObj.hostname;
  if (urlObj.port) result += ":" + urlObj.port;
  if (urlObj.pathname) result += urlObj.pathname;
  if (urlObj.search) result += urlObj.search;
  if (urlObj.hash) result += urlObj.hash;
  return result;
}

export function resolve(from: string, to: string): string {
  return new globalThis.URL(to, from).href;
}

export function fileURLToPath(url: string | URL): string {
  const urlStr = typeof url === "string" ? url : url.href;
  if (!urlStr.startsWith("file://")) throw new Error("Invalid file URL");
  return decodeURIComponent(urlStr.replace(/^file:\/\//, ""));
}

export function pathToFileURL(path: string): URL {
  return new globalThis.URL(
    "file://" + encodeURIComponent(path).replace(/%2F/g, "/"),
  );
}

export function domainToASCII(domain: string): string {
  return domain;
}
export function domainToUnicode(domain: string): string {
  return domain;
}

export default {
  URL,
  URLSearchParams,
  parse,
  format,
  resolve,
  fileURLToPath,
  pathToFileURL,
  domainToASCII,
  domainToUnicode,
};

const SITE = "https://jiki.sh";

export function ogPathFor(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return "/og/index.png";
  return `/og${clean}.png`;
}

export function ogImageUrlFor(pathname: string, site?: URL | string): string {
  const base = (site ? site.toString() : SITE).replace(/\/+$/, "");
  return `${base}${ogPathFor(pathname)}`;
}

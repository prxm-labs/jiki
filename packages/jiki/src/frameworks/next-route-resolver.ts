/**
 * Next.js route resolution
 * Standalone functions for resolving App Router routes, Pages Router routes,
 * API routes, and file extensions.
 */

import { type AppRoute } from "./next-html-generator";

/** Context needed by route resolution functions */
export interface RouteResolverContext {
  exists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
  readdir: (path: string) => string[];
}

const PAGE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const API_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export function hasAppRouter(
  appDir: string,
  ctx: RouteResolverContext,
): boolean {
  try {
    if (!ctx.exists(appDir)) return false;

    for (const ext of PAGE_EXTENSIONS) {
      if (ctx.exists(`${appDir}/page${ext}`)) return true;
    }

    try {
      const entries = ctx.readdir(appDir);
      for (const entry of entries) {
        if (
          /^\([^)]+\)$/.test(entry) &&
          ctx.isDirectory(`${appDir}/${entry}`)
        ) {
          for (const ext of PAGE_EXTENSIONS) {
            if (ctx.exists(`${appDir}/${entry}/page${ext}`)) return true;
          }
        }
      }
    } catch {
      /* ignore */
    }

    for (const ext of PAGE_EXTENSIONS) {
      if (ctx.exists(`${appDir}/layout${ext}`)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function resolveAppRoute(
  appDir: string,
  pathname: string,
  ctx: RouteResolverContext,
): AppRoute | null {
  const segments = pathname === "/" ? [] : pathname.split("/").filter(Boolean);
  return resolveAppDynamicRoute(appDir, segments, ctx);
}

function resolveAppDynamicRoute(
  appDir: string,
  segments: string[],
  ctx: RouteResolverContext,
): AppRoute | null {
  const collectLayout = (dirPath: string, layouts: string[]): string[] => {
    for (const ext of PAGE_EXTENSIONS) {
      const layoutPath = `${dirPath}/layout${ext}`;
      if (ctx.exists(layoutPath) && !layouts.includes(layoutPath)) {
        return [...layouts, layoutPath];
      }
    }
    return layouts;
  };

  const findPage = (dirPath: string): string | null => {
    for (const ext of PAGE_EXTENSIONS) {
      const pagePath = `${dirPath}/page${ext}`;
      if (ctx.exists(pagePath)) return pagePath;
    }
    return null;
  };

  const findConventionFile = (dirPath: string, name: string): string | null => {
    for (const ext of PAGE_EXTENSIONS) {
      const filePath = `${dirPath}/${name}${ext}`;
      if (ctx.exists(filePath)) return filePath;
    }
    return null;
  };

  const findNearestConventionFile = (
    dirPath: string,
    name: string,
  ): string | null => {
    let current = dirPath;
    while (current.startsWith(appDir)) {
      const file = findConventionFile(current, name);
      if (file) return file;
      const parent = current.replace(/\/[^/]+$/, "");
      if (parent === current) break;
      current = parent;
    }
    return null;
  };

  const getRouteGroups = (dirPath: string): string[] => {
    try {
      const entries = ctx.readdir(dirPath);
      return entries.filter(
        e => /^\([^)]+\)$/.test(e) && ctx.isDirectory(`${dirPath}/${e}`),
      );
    } catch {
      return [];
    }
  };

  const tryPath = (
    dirPath: string,
    remainingSegments: string[],
    layouts: string[],
    params: Record<string, string | string[]>,
  ): AppRoute | null => {
    layouts = collectLayout(dirPath, layouts);

    if (remainingSegments.length === 0) {
      const page = findPage(dirPath);
      if (page) {
        return {
          page,
          layouts,
          params,
          loading: findNearestConventionFile(dirPath, "loading") || undefined,
          error: findNearestConventionFile(dirPath, "error") || undefined,
          notFound:
            findNearestConventionFile(dirPath, "not-found") || undefined,
        };
      }

      const groups = getRouteGroups(dirPath);
      for (const group of groups) {
        const groupPath = `${dirPath}/${group}`;
        const groupLayouts = collectLayout(groupPath, layouts);
        const page = findPage(groupPath);
        if (page) {
          return {
            page,
            layouts: groupLayouts,
            params,
            loading:
              findNearestConventionFile(groupPath, "loading") || undefined,
            error: findNearestConventionFile(groupPath, "error") || undefined,
            notFound:
              findNearestConventionFile(groupPath, "not-found") || undefined,
          };
        }
      }

      return null;
    }

    const [current, ...rest] = remainingSegments;

    const exactPath = `${dirPath}/${current}`;
    if (ctx.isDirectory(exactPath)) {
      const result = tryPath(exactPath, rest, layouts, params);
      if (result) return result;
    }

    const groups = getRouteGroups(dirPath);
    for (const group of groups) {
      const groupPath = `${dirPath}/${group}`;
      const groupLayouts = collectLayout(groupPath, layouts);

      const groupExactPath = `${groupPath}/${current}`;
      if (ctx.isDirectory(groupExactPath)) {
        const result = tryPath(groupExactPath, rest, groupLayouts, params);
        if (result) return result;
      }

      try {
        const groupEntries = ctx.readdir(groupPath);
        for (const entry of groupEntries) {
          if (entry.startsWith("[...") && entry.endsWith("]")) {
            const dynamicPath = `${groupPath}/${entry}`;
            if (ctx.isDirectory(dynamicPath)) {
              const paramName = entry.slice(4, -1);
              const newParams = { ...params, [paramName]: [current, ...rest] };
              const result = tryPath(dynamicPath, [], groupLayouts, newParams);
              if (result) return result;
            }
          } else if (entry.startsWith("[[...") && entry.endsWith("]]")) {
            const dynamicPath = `${groupPath}/${entry}`;
            if (ctx.isDirectory(dynamicPath)) {
              const paramName = entry.slice(5, -2);
              const newParams = { ...params, [paramName]: [current, ...rest] };
              const result = tryPath(dynamicPath, [], groupLayouts, newParams);
              if (result) return result;
            }
          } else if (
            entry.startsWith("[") &&
            entry.endsWith("]") &&
            !entry.includes(".")
          ) {
            const dynamicPath = `${groupPath}/${entry}`;
            if (ctx.isDirectory(dynamicPath)) {
              const paramName = entry.slice(1, -1);
              const newParams = { ...params, [paramName]: current };
              const result = tryPath(
                dynamicPath,
                rest,
                groupLayouts,
                newParams,
              );
              if (result) return result;
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const entries = ctx.readdir(dirPath);
      for (const entry of entries) {
        if (entry.startsWith("[...") && entry.endsWith("]")) {
          const dynamicPath = `${dirPath}/${entry}`;
          if (ctx.isDirectory(dynamicPath)) {
            const paramName = entry.slice(4, -1);
            const newParams = { ...params, [paramName]: [current, ...rest] };
            const result = tryPath(dynamicPath, [], layouts, newParams);
            if (result) return result;
          }
        } else if (entry.startsWith("[[...") && entry.endsWith("]]")) {
          const dynamicPath = `${dirPath}/${entry}`;
          if (ctx.isDirectory(dynamicPath)) {
            const paramName = entry.slice(5, -2);
            const newParams = { ...params, [paramName]: [current, ...rest] };
            const result = tryPath(dynamicPath, [], layouts, newParams);
            if (result) return result;
          }
        } else if (
          entry.startsWith("[") &&
          entry.endsWith("]") &&
          !entry.includes(".")
        ) {
          const dynamicPath = `${dirPath}/${entry}`;
          if (ctx.isDirectory(dynamicPath)) {
            const paramName = entry.slice(1, -1);
            const newParams = { ...params, [paramName]: current };
            const result = tryPath(dynamicPath, rest, layouts, newParams);
            if (result) return result;
          }
        }
      }
    } catch {
      /* ignore */
    }

    return null;
  };

  const layouts: string[] = [];
  for (const ext of PAGE_EXTENSIONS) {
    const rootLayout = `${appDir}/layout${ext}`;
    if (ctx.exists(rootLayout)) {
      layouts.push(rootLayout);
      break;
    }
  }

  return tryPath(appDir, segments, layouts, {});
}

export function resolveAppRouteHandler(
  appDir: string,
  pathname: string,
  ctx: RouteResolverContext,
): string | null {
  const segments = pathname === "/" ? [] : pathname.split("/").filter(Boolean);
  let dirPath = appDir;
  for (const segment of segments) dirPath = `${dirPath}/${segment}`;

  for (const ext of API_EXTENSIONS) {
    const routePath = `${dirPath}/route${ext}`;
    if (ctx.exists(routePath)) return routePath;
  }

  return resolveAppRouteHandlerDynamic(appDir, segments, ctx);
}

function resolveAppRouteHandlerDynamic(
  appDir: string,
  segments: string[],
  ctx: RouteResolverContext,
): string | null {
  const tryPath = (
    dirPath: string,
    remainingSegments: string[],
  ): string | null => {
    if (remainingSegments.length === 0) {
      for (const ext of API_EXTENSIONS) {
        const routePath = `${dirPath}/route${ext}`;
        if (ctx.exists(routePath)) return routePath;
      }

      try {
        const entries = ctx.readdir(dirPath);
        for (const entry of entries) {
          if (
            /^\([^)]+\)$/.test(entry) &&
            ctx.isDirectory(`${dirPath}/${entry}`)
          ) {
            for (const ext of API_EXTENSIONS) {
              const routePath = `${dirPath}/${entry}/route${ext}`;
              if (ctx.exists(routePath)) return routePath;
            }
          }
        }
      } catch {
        /* ignore */
      }

      return null;
    }

    const [current, ...rest] = remainingSegments;

    const exactPath = `${dirPath}/${current}`;
    if (ctx.isDirectory(exactPath)) {
      const result = tryPath(exactPath, rest);
      if (result) return result;
    }

    try {
      const entries = ctx.readdir(dirPath);
      for (const entry of entries) {
        if (
          /^\([^)]+\)$/.test(entry) &&
          ctx.isDirectory(`${dirPath}/${entry}`)
        ) {
          const groupExact = `${dirPath}/${entry}/${current}`;
          if (ctx.isDirectory(groupExact)) {
            const result = tryPath(groupExact, rest);
            if (result) return result;
          }
        }
        if (
          entry.startsWith("[") &&
          entry.endsWith("]") &&
          !entry.includes(".")
        ) {
          const dynamicPath = `${dirPath}/${entry}`;
          if (ctx.isDirectory(dynamicPath)) {
            const result = tryPath(dynamicPath, rest);
            if (result) return result;
          }
        }
        if (entry.startsWith("[...") && entry.endsWith("]")) {
          const dynamicPath = `${dirPath}/${entry}`;
          if (ctx.isDirectory(dynamicPath)) {
            const result = tryPath(dynamicPath, []);
            if (result) return result;
          }
        }
      }
    } catch {
      /* ignore */
    }

    return null;
  };

  return tryPath(appDir, segments);
}

export function resolvePageFile(
  pagesDir: string,
  pathname: string,
  ctx: RouteResolverContext,
): string | null {
  if (pathname === "/") pathname = "/index";

  for (const ext of PAGE_EXTENSIONS) {
    const filePath = `${pagesDir}${pathname}${ext}`;
    if (ctx.exists(filePath)) return filePath;
  }

  for (const ext of PAGE_EXTENSIONS) {
    const filePath = `${pagesDir}${pathname}/index${ext}`;
    if (ctx.exists(filePath)) return filePath;
  }

  return resolveDynamicRoute(pagesDir, pathname, ctx);
}

function resolveDynamicRoute(
  pagesDir: string,
  pathname: string,
  ctx: RouteResolverContext,
): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const tryPath = (
    dirPath: string,
    remainingSegments: string[],
  ): string | null => {
    if (remainingSegments.length === 0) {
      for (const ext of PAGE_EXTENSIONS) {
        const indexPath = `${dirPath}/index${ext}`;
        if (ctx.exists(indexPath)) return indexPath;
      }
      return null;
    }

    const [current, ...rest] = remainingSegments;
    const exactPath = `${dirPath}/${current}`;

    for (const ext of PAGE_EXTENSIONS) {
      if (rest.length === 0 && ctx.exists(exactPath + ext))
        return exactPath + ext;
    }

    if (ctx.isDirectory(exactPath)) {
      const exactResult = tryPath(exactPath, rest);
      if (exactResult) return exactResult;
    }

    try {
      const entries = ctx.readdir(dirPath);
      for (const entry of entries) {
        for (const ext of PAGE_EXTENSIONS) {
          const dynamicFilePattern = /^\[([^\]]+)\]$/;
          const nameWithoutExt = entry.replace(ext, "");
          if (entry.endsWith(ext) && dynamicFilePattern.test(nameWithoutExt)) {
            if (rest.length === 0) {
              const filePath = `${dirPath}/${entry}`;
              if (ctx.exists(filePath)) return filePath;
            }
          }
        }

        if (
          entry.startsWith("[") &&
          entry.endsWith("]") &&
          !entry.includes(".")
        ) {
          const dynamicPath = `${dirPath}/${entry}`;
          if (ctx.isDirectory(dynamicPath)) {
            const dynamicResult = tryPath(dynamicPath, rest);
            if (dynamicResult) return dynamicResult;
          }
        }

        for (const ext of PAGE_EXTENSIONS) {
          if (entry.startsWith("[...") && entry.endsWith("]" + ext)) {
            const filePath = `${dirPath}/${entry}`;
            if (ctx.exists(filePath)) return filePath;
          }
        }
      }
    } catch {
      /* ignore */
    }

    return null;
  };

  return tryPath(pagesDir, segments);
}

export function resolveApiFile(
  pagesDir: string,
  pathname: string,
  ctx: RouteResolverContext,
): string | null {
  const apiPath = pathname.replace(/^\/api/, `${pagesDir}/api`);

  for (const ext of API_EXTENSIONS) {
    const filePath = apiPath + ext;
    if (ctx.exists(filePath)) return filePath;
  }

  for (const ext of API_EXTENSIONS) {
    const filePath = `${apiPath}/index${ext}`;
    if (ctx.exists(filePath)) return filePath;
  }

  return null;
}

export function resolveFileWithExtension(
  pathname: string,
  ctx: RouteResolverContext,
): string | null {
  if (/\.\w+$/.test(pathname) && ctx.exists(pathname)) return pathname;

  const extensions = [".tsx", ".ts", ".jsx", ".js"];

  for (const ext of extensions) {
    const withExt = pathname + ext;
    if (ctx.exists(withExt)) return withExt;
  }

  for (const ext of extensions) {
    const indexPath = pathname + "/index" + ext;
    if (ctx.exists(indexPath)) return indexPath;
  }

  return null;
}

export function needsTransform(path: string): boolean {
  return /\.(jsx|tsx|ts)$/.test(path);
}

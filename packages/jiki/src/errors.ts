import type { NodeError } from "./fs-errors";
import type { BundleError } from "./browser-bundle";

export type ErrorCategory =
  | "build"
  | "runtime"
  | "bundle"
  | "install"
  | "filesystem";

export interface ContainerError {
  id: string;
  category: ErrorCategory;
  title: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
  timestamp: number;
  raw?: unknown;
  /** Actionable fix suggestions for the error. */
  suggestions?: string[];
}

let errorSeq = 0;

function uid(): string {
  return `err_${++errorSeq}_${Date.now().toString(36)}`;
}

const FRIENDLY_FS_CODES: Record<string, string> = {
  ENOENT: "File or directory not found",
  ENOTDIR: "Path is not a directory",
  EISDIR: "Expected a file but found a directory",
  EEXIST: "File already exists",
  ENOTEMPTY: "Directory is not empty",
  ELOOP: "Too many symbolic links",
};

const RUNTIME_ERROR_TITLES: Record<string, string> = {
  ReferenceError: "Reference Error",
  TypeError: "Type Error",
  SyntaxError: "Syntax Error",
  RangeError: "Range Error",
  URIError: "URI Error",
  EvalError: "Eval Error",
};

function extractLocation(stack?: string): {
  file?: string;
  line?: number;
  column?: number;
} {
  if (!stack) return {};
  const match = stack.match(/(?:at\s+.+?\s+\(|at\s+)(.+?):(\d+):(\d+)/);
  if (match) {
    return {
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    };
  }
  const simpleMatch = stack.match(/(.+?):(\d+):(\d+)/);
  if (simpleMatch) {
    return {
      file: simpleMatch[1],
      line: parseInt(simpleMatch[2], 10),
      column: parseInt(simpleMatch[3], 10),
    };
  }
  return {};
}

function parseBuildError(raw: unknown): Partial<ContainerError> {
  if (raw && typeof raw === "object" && "text" in raw) {
    const msg = raw as {
      text?: string;
      location?: {
        file?: string;
        line?: number;
        column?: number;
        lineText?: string;
      };
    };
    const loc = msg.location;
    let message = msg.text || "Unknown build error";
    if (loc?.lineText) {
      message += `\n\n  ${loc.line} | ${loc.lineText}`;
      if (loc.column != null) {
        message += `\n  ${" ".repeat(String(loc.line).length)} | ${" ".repeat(loc.column)}^`;
      }
    }
    return {
      title: "Build Error",
      message,
      file: loc?.file,
      line: loc?.line,
      column: loc?.column,
    };
  }

  if (raw instanceof Error) {
    const loc = extractLocation(raw.stack);
    const isTranspile =
      raw.message.includes("Transform failed") ||
      raw.message.includes("Parse error");
    return {
      title: isTranspile ? "Transpilation Error" : "Build Error",
      message: raw.message,
      stack: raw.stack,
      ...loc,
    };
  }

  return {
    title: "Build Error",
    message: String(raw),
  };
}

function parseRuntimeError(raw: unknown): Partial<ContainerError> {
  if (raw instanceof Error) {
    const errorType = raw.constructor.name;
    const loc = extractLocation(raw.stack);
    return {
      title: RUNTIME_ERROR_TITLES[errorType] || "Runtime Error",
      message: raw.message,
      stack: raw.stack,
      ...loc,
    };
  }

  if (raw && typeof raw === "object" && "message" in raw) {
    const err = raw as {
      message: string;
      name?: string;
      stack?: string;
      filename?: string;
      lineno?: number;
      colno?: number;
    };
    const loc = err.filename
      ? { file: err.filename, line: err.lineno, column: err.colno }
      : extractLocation(err.stack);
    return {
      title: RUNTIME_ERROR_TITLES[err.name || ""] || "Runtime Error",
      message: err.message,
      stack: err.stack,
      ...loc,
    };
  }

  return {
    title: "Runtime Error",
    message: String(raw),
  };
}

function parseBundleError(raw: unknown): Partial<ContainerError> {
  if (raw && typeof raw === "object" && "packageName" in raw) {
    const err = raw as BundleError;
    return {
      title: "Bundle Error",
      message: `Failed to bundle "${err.packageName}": ${err.message}`,
    };
  }

  if (raw instanceof Error) {
    const pkgMatch = raw.message.match(/Cannot resolve package "([^"]+)"/);
    return {
      title: pkgMatch ? `Cannot resolve "${pkgMatch[1]}"` : "Bundle Error",
      message: raw.message,
      stack: raw.stack,
    };
  }

  return {
    title: "Bundle Error",
    message: String(raw),
  };
}

function parseInstallError(raw: unknown): Partial<ContainerError> {
  if (raw instanceof Error) {
    const versionMatch = raw.message.match(/No matching version for (.+)/);
    const notFoundMatch = raw.message.match(/Version (.+?) not found for (.+)/);

    let title = "Install Error";
    if (versionMatch) title = `No matching version: ${versionMatch[1]}`;
    else if (notFoundMatch)
      title = `Version not found: ${notFoundMatch[2]}@${notFoundMatch[1]}`;
    else if (raw.message.includes("fetch")) title = "Network Error";

    return {
      title,
      message: raw.message,
      stack: raw.stack,
    };
  }

  return {
    title: "Install Error",
    message: String(raw),
  };
}

function parseFilesystemError(raw: unknown): Partial<ContainerError> {
  const nodeErr = raw as Partial<NodeError>;
  if (nodeErr && typeof nodeErr === "object" && nodeErr.code) {
    const friendly = FRIENDLY_FS_CODES[nodeErr.code] || nodeErr.code;
    return {
      title: friendly,
      message: nodeErr.path
        ? `${friendly}: ${nodeErr.path}`
        : nodeErr.message || friendly,
      file: nodeErr.path,
    };
  }

  if (raw instanceof Error) {
    return {
      title: "Filesystem Error",
      message: raw.message,
      stack: raw.stack,
    };
  }

  return {
    title: "Filesystem Error",
    message: String(raw),
  };
}

const PARSERS: Record<
  ErrorCategory,
  (raw: unknown) => Partial<ContainerError>
> = {
  build: parseBuildError,
  runtime: parseRuntimeError,
  bundle: parseBundleError,
  install: parseInstallError,
  filesystem: parseFilesystemError,
};

/**
 * Generate actionable fix suggestions based on the error message.
 */
function generateSuggestions(
  category: ErrorCategory,
  message: string,
): string[] {
  const suggestions: string[] = [];
  const msg = message.toLowerCase();

  // "Cannot find module 'X'" → suggest npm install
  const cannotFindModule = message.match(/Cannot find module ['"]([^'"]+)['"]/);
  if (cannotFindModule) {
    const mod = cannotFindModule[1];
    if (!mod.startsWith(".") && !mod.startsWith("/")) {
      const pkg =
        mod.includes("/") && mod.startsWith("@")
          ? mod.split("/").slice(0, 2).join("/")
          : mod.split("/")[0];
      suggestions.push(`Run: npm install ${pkg}`);
    } else {
      suggestions.push(`Check that the file "${mod}" exists`);
    }
  }

  // "X is not defined" → suggest import
  const notDefined = message.match(/(\w+) is not defined/);
  if (notDefined && category === "runtime") {
    const name = notDefined[1];
    if (/^[A-Z]/.test(name)) {
      suggestions.push(`Did you forget to import ${name}?`);
    }
  }

  // Transpiler not initialized
  if (msg.includes("transpiler not initialized")) {
    suggestions.push(
      "Call await container.init() before running TypeScript files",
    );
  }

  // File not pre-transpiled
  if (msg.includes("has not been pre-transpiled")) {
    suggestions.push(
      "Call await container.init() to initialize the transpiler",
    );
    suggestions.push("Or use kernel.prepareFile() to pre-transpile the file");
  }

  // JSON parse errors
  if (msg.includes("unexpected token") && msg.includes("json")) {
    suggestions.push(
      "Check the JSON file for syntax errors (trailing commas, missing quotes)",
    );
  }

  // Network/fetch errors during install
  if (
    category === "install" &&
    (msg.includes("fetch") || msg.includes("network"))
  ) {
    suggestions.push("Check your internet connection");
    suggestions.push("The npm registry may be temporarily unavailable");
  }

  // Version not found
  if (msg.includes("version") && msg.includes("not found")) {
    suggestions.push(
      "Check that the version exists: npm view <package> versions",
    );
    suggestions.push('Try using "latest" instead of a specific version');
  }

  // Sandbox errors
  if (msg.includes("[sandbox]")) {
    if (msg.includes("read-only")) {
      suggestions.push(
        "The container is in read-only mode — remove sandbox.fs.readOnly to allow writes",
      );
    }
    if (msg.includes("outside allowed paths")) {
      suggestions.push("Add the path to sandbox.fs.allowedPaths");
    }
    if (msg.includes("file count limit")) {
      suggestions.push(
        "Increase sandbox.limits.maxFileCount or clear unused files",
      );
    }
    if (msg.includes("memory limit")) {
      suggestions.push(
        "Increase sandbox.limits.maxMemoryMB or remove large files",
      );
    }
  }

  return suggestions;
}

export function parseError(
  category: ErrorCategory,
  raw: unknown,
): ContainerError {
  const parsed = PARSERS[category](raw);
  const message = parsed.message || String(raw);
  return {
    id: uid(),
    category,
    title: parsed.title || "Error",
    message,
    file: parsed.file,
    line: parsed.line,
    column: parsed.column,
    stack: parsed.stack,
    timestamp: Date.now(),
    raw,
    suggestions: generateSuggestions(category, message),
  };
}

export function formatErrorText(error: ContainerError): string {
  const parts: string[] = [];

  const tag = `[${error.category.toUpperCase()}]`;
  parts.push(`${tag} ${error.title}`);

  if (error.file) {
    let loc = error.file;
    if (error.line != null) {
      loc += `:${error.line}`;
      if (error.column != null) loc += `:${error.column}`;
    }
    parts.push(`  at ${loc}`);
  }

  parts.push("");
  parts.push(error.message);

  if (error.suggestions && error.suggestions.length > 0) {
    parts.push("");
    parts.push("Suggestions:");
    for (const s of error.suggestions) {
      parts.push(`  - ${s}`);
    }
  }

  if (error.stack) {
    parts.push("");
    parts.push(error.stack);
  }

  return parts.join("\n");
}

export function formatErrorHtml(error: ContainerError): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/`/g, "&#96;");

  let loc = "";
  if (error.file) {
    loc = esc(error.file);
    if (error.line != null) {
      loc += `:${error.line}`;
      if (error.column != null) loc += `:${error.column}`;
    }
    loc = `<div style="font-size:11px;color:#fca5a5;margin-top:4px;">${loc}</div>`;
  }

  let stack = "";
  if (error.stack) {
    stack = `<pre style="font-size:11px;color:#a1a1aa;margin-top:8px;white-space:pre-wrap;max-height:120px;overflow:auto;">${esc(error.stack)}</pre>`;
  }

  return `<div style="
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    background: #1c1017;
    border: 1px solid #7f1d1d;
    border-radius: 8px;
    padding: 12px 16px;
    color: #fecaca;
    max-width: 480px;
  ">
    <div style="font-weight:600;font-size:13px;color:#fca5a5;">
      ${esc(error.title)}
    </div>
    <div style="font-size:12px;margin-top:6px;color:#e4e4e7;line-height:1.4;">
      ${esc(error.message)}
    </div>
    ${loc}${stack}
  </div>`;
}

export function errorOverlayScript(): string {
  function overlayIIFE() {
    var overlay: HTMLDivElement | null = null;
    var errors: Array<{
      title?: string;
      message: string;
      file?: string | null;
      line?: number | null;
      column?: number | null;
      stack?: string | null;
    }> = [];

    function esc(s: string) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/`/g, "&#96;");
    }

    function dismiss() {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }

    function render() {
      if (errors.length === 0) {
        dismiss();
        return;
      }

      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "__jiki_error_overlay";
        overlay.style.cssText = [
          "position:fixed",
          "bottom:12px",
          "right:12px",
          "z-index:2147483647",
          "max-width:420px",
          "max-height:260px",
          "overflow:auto",
          "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
          "background:rgba(24,8,14,0.95)",
          "border:1px solid #991b1b",
          "border-radius:10px",
          "padding:10px 14px",
          "color:#fecaca",
          "font-size:12px",
          "line-height:1.4",
          "box-shadow:0 8px 32px rgba(0,0,0,0.5)",
          "backdrop-filter:blur(8px)",
        ].join(";");
        document.body.appendChild(overlay);
      }

      var last = errors[errors.length - 1];

      var badge = errors.length > 1 ? " (" + errors.length + ")" : "";

      var loc = "";
      if (last.file) {
        loc = esc(last.file);
        if (last.line != null) loc += ":" + last.line;
        if (last.column != null) loc += ":" + last.column;
      }

      var header = document.createElement("div");
      header.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;";

      var titleEl = document.createElement("div");
      titleEl.style.cssText = "font-weight:600;font-size:12px;color:#fca5a5;";
      titleEl.textContent = (last.title || "Error") + badge;

      var closeBtn = document.createElement("button");
      closeBtn.style.cssText =
        "background:none;border:none;color:#a1a1aa;cursor:pointer;" +
        "font-size:16px;padding:0 0 0 8px;line-height:1;";
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", function () {
        errors = [];
        dismiss();
      });

      header.appendChild(titleEl);
      header.appendChild(closeBtn);

      var msgEl = document.createElement("div");
      msgEl.style.cssText =
        "font-size:11px;color:#e4e4e7;margin-top:4px;word-break:break-word;";
      msgEl.textContent = last.message;

      overlay.innerHTML = "";
      overlay.appendChild(header);
      overlay.appendChild(msgEl);

      if (loc) {
        var locEl = document.createElement("div");
        locEl.style.cssText = "font-size:10px;color:#fca5a5;margin-top:2px;";
        locEl.textContent = loc;
        overlay.appendChild(locEl);
      }
    }

    function pushError(data: (typeof errors)[number]) {
      errors.push(data);
      render();
      try {
        window.parent.postMessage(
          {
            type: "__jiki_error",
            error: {
              message: data.message,
              title: data.title,
              file: data.file || null,
              line: data.line || null,
              column: data.column || null,
              stack: data.stack || null,
            },
          },
          "*",
        );
      } catch (_e) {
        /* cross-origin */
      }
    }

    window.addEventListener("error", function (event: ErrorEvent) {
      var error = event.error;
      var name =
        (error && error.constructor && error.constructor.name) || "Error";
      pushError({
        title:
          name === "Error"
            ? "Runtime Error"
            : name.replace(/([a-z])([A-Z])/g, "$1 $2"),
        message: error ? error.message : event.message || "Unknown error",
        file: event.filename || null,
        line: event.lineno || null,
        column: event.colno || null,
        stack: error && error.stack ? error.stack : null,
      });
    });

    window.addEventListener(
      "unhandledrejection",
      function (event: PromiseRejectionEvent) {
        var reason = event.reason;
        var msg = reason instanceof Error ? reason.message : String(reason);
        var stack = reason instanceof Error ? reason.stack : null;
        pushError({
          title: "Unhandled Promise Rejection",
          message: msg,
          stack: stack,
        });
      },
    );
  }

  return "<script>(" + overlayIIFE.toString() + ")()</script>";
}

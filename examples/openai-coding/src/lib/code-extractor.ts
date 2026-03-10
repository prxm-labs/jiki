export interface ExtractedFile {
  filename: string;
  code: string;
}

/**
 * Extract named code blocks from AI response.
 * Supports: ```astro filename="/src/pages/index.astro"
 *           ```tsx filename="/src/components/Counter.tsx"
 */
export function extractNamedFiles(text: string): Record<string, string> {
  const files: Record<string, string> = {};

  // Match code blocks with explicit filename labels
  const labeledRegex = /```\w*\s+filename="([^"]+)"\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = labeledRegex.exec(text)) !== null) {
    files[match[1]] = match[2].trim();
  }

  if (Object.keys(files).length > 0) return files;

  // Fallback: match code blocks prefixed with a filename comment
  // e.g., <!-- /src/pages/index.astro --> or // /src/components/Counter.tsx
  const commentRegex = /(?:<!--\s*(\/src\/[^\s]+)\s*-->|\/\/\s*(\/src\/[^\s]+))\s*\n```\w*\n([\s\S]*?)```/g;

  while ((match = commentRegex.exec(text)) !== null) {
    const filename = match[1] || match[2];
    files[filename] = match[3].trim();
  }

  if (Object.keys(files).length > 0) return files;

  // Last resort: any code blocks, try to infer filename from content
  const genericRegex = /```(\w*)\n([\s\S]*?)```/g;
  while ((match = genericRegex.exec(text)) !== null) {
    const lang = match[1];
    const code = match[2].trim();

    if (lang === 'astro' || code.includes('<slot') || code.includes('Astro.props')) {
      // Try to detect which page by content
      if (!files['/src/pages/index.astro'] && (code.includes('hero') || code.includes('Hero') || code.includes('home') || code.includes('Home'))) {
        files['/src/pages/index.astro'] = code;
      } else if (!files['/src/pages/about.astro']) {
        files['/src/pages/about.astro'] = code;
      } else {
        files[`/src/pages/page-${Object.keys(files).length}.astro`] = code;
      }
    } else if (lang === 'tsx' || lang === 'jsx' || /function\s+\w+/.test(code)) {
      const fnMatch = code.match(/function\s+(\w+)/);
      const name = fnMatch ? fnMatch[1] : 'Component';
      files[`/src/components/${name}.tsx`] = code;
    }
  }

  return files;
}

export interface ExtractedCode {
  language: string;
  code: string;
}

export function extractCodeBlocks(text: string): ExtractedCode[] {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: ExtractedCode[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'jsx',
      code: match[2].trim(),
    });
  }

  return blocks;
}

export function extractAppCode(text: string): string | null {
  const blocks = extractCodeBlocks(text);
  if (blocks.length === 0) return null;

  // Prefer the last block that contains a function named App
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (/function\s+App\s*\(/.test(blocks[i].code)) {
      return blocks[i].code;
    }
  }

  // Fallback: if there's a block with any function component, wrap it as App
  for (let i = blocks.length - 1; i >= 0; i--) {
    const code = blocks[i].code;
    if (/function\s+\w+\s*\(/.test(code)) {
      return code;
    }
  }

  // Last resort: return the last code block as-is
  return blocks[blocks.length - 1].code;
}

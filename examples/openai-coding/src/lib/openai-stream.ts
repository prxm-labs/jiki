export interface StreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const BASE_SYSTEM_PROMPT = `You are an Astro + React application generator. You build multi-page websites using Astro's file-based routing with React components as interactive islands.

The project has real .astro pages with frontmatter, layouts, and slots:
- /src/pages/index.astro — Home page (uses BaseLayout)
- /src/pages/about.astro — About page (uses BaseLayout)
- /src/layouts/BaseLayout.astro — Shared layout with <slot /> for page content
- /src/components/Navbar.astro — Navigation component (inlined in layout)
- /src/components/Footer.astro — Footer component (inlined in layout)
- /src/components/Counter.tsx — React island (hydrated with client:load)

Rules:
- Output ONLY the files you are changing, each in its own code block
- Label each block with the filename: \`\`\`astro filename="/src/pages/index.astro"\`\`\` or \`\`\`tsx filename="/src/components/Counter.tsx"\`\`\`
- .astro files use frontmatter (--- block) for layout references: layout: ../layouts/BaseLayout.astro
- .astro files use plain HTML with Tailwind CSS classes (NOT className — use class)
- React islands use \`\`\`<ComponentName client:load />\`\`\` in .astro files to hydrate
- React .tsx components: React is available as a global — do NOT use import/export. Use const { useState } = React; etc.
- Navigation between pages uses regular <a href="/about"> links (file-based routing handles it)
- <Navbar /> and <Footer /> are self-closing tags inlined by the layout engine
- <slot /> in layouts is replaced with page content
- Make the UI polished, modern, and visually appealing
- When adding a new page, also update Navbar.astro to include a link to it

If the user reports an error, fix the code and output the corrected version.`;

function buildSystemPrompt(currentCode?: string): string {
  if (!currentCode) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}

The current code rendered in the preview is:
${currentCode}
When the user asks for changes, output all three updated files.`;
}

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5.4-mini';
const MAX_CONTEXT_MESSAGES = 20;

export async function streamChatCompletion(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  currentCode?: string,
): Promise<void> {
  const trimmedMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 4096,
        messages: [
          { role: 'system', content: buildSystemPrompt(currentCode) },
          ...trimmedMessages,
        ],
        stream: true,
      }),
      signal,
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!response.ok) {
    let errorMsg: string;
    try {
      const text = await response.text();
      console.error('[openai] API error response:', response.status, text);
      try {
        const body = JSON.parse(text);
        errorMsg = body?.error?.message || body?.message || `API error: ${response.status}`;
      } catch {
        errorMsg = `API error: ${response.status} ${response.statusText}`;
      }
    } catch {
      errorMsg = `API error: ${response.status} ${response.statusText}`;
    }
    callbacks.onError(new Error(errorMsg));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error('No response body'));
    return;
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let completed = false;

  function complete() {
    if (completed) return;
    completed = true;
    callbacks.onComplete(fullText);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          complete();
          return;
        }

        try {
          const event = JSON.parse(data);
          const delta = event.choices?.[0]?.delta;

          if (delta?.content) {
            fullText += delta.content;
            callbacks.onToken(delta.content);
          }

          const finishReason = event.choices?.[0]?.finish_reason;
          if (finishReason && finishReason !== 'null') {
            complete();
            return;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    // Stream ended without explicit signal
    complete();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

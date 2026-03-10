export interface StreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const BASE_SYSTEM_PROMPT = `You are a React component generator. When the user describes a UI component or application, generate a complete React component.

Rules:
- Output a single function component named App
- Use React.useState and React.useEffect (React is available as a global — do NOT use import statements)
- Use Tailwind CSS classes for all styling
- The component must be self-contained in a single code block
- Wrap your code in \`\`\`jsx fences
- Do not use import or export statements
- Make the UI polished, modern, and visually appealing
- When the user asks to modify the existing component, output the full updated component
- Keep all state and logic inside the App function

If the user reports an error, fix the code and output the corrected version.`;

function buildSystemPrompt(currentCode?: string): string {
  if (!currentCode) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}

The current component code rendered in the preview is:
\`\`\`jsx
${currentCode}
\`\`\`
When the user asks for changes, modify this existing code and output the full updated component.`;
}

// Proxied through Vite dev server to avoid CORS issues.
// In production, replace with your own backend proxy.
const API_URL = '/api/mistral/v1/chat/completions';
const MODEL = 'codestral-latest';
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
        max_tokens: 4096,
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
      console.error('[mistral] API error response:', response.status, text);
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
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          const delta = event.choices?.[0]?.delta;

          if (delta?.content) {
            fullText += delta.content;
            callbacks.onToken(delta.content);
          }

          if (event.choices?.[0]?.finish_reason === 'stop') {
            callbacks.onComplete(fullText);
            return;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    // Stream ended without explicit stop
    callbacks.onComplete(fullText);
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

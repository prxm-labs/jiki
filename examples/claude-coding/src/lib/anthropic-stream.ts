export interface StreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const SYSTEM_PROMPT = `You are a React component generator. When the user describes a UI component or application, generate a complete React component.

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

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-6';
const MAX_CONTEXT_MESSAGES = 20;

export async function streamChatCompletion(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const trimmedMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        stream: true,
        messages: trimmedMessages,
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
      const body = await response.json();
      errorMsg = body?.error?.message || `API error: ${response.status}`;
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

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;
            callbacks.onToken(text);
          }

          if (event.type === 'message_stop') {
            callbacks.onComplete(fullText);
            return;
          }

          if (event.type === 'error') {
            callbacks.onError(new Error(event.error?.message || 'Stream error'));
            return;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    // Stream ended without message_stop
    callbacks.onComplete(fullText);
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

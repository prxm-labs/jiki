import { useState, useCallback } from 'react';

const STORAGE_KEY = 'jiki-openai-api-key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function ApiKeyModal({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = key.trim();

      if (!trimmed) {
        setError('API key is required');
        return;
      }

      if (!trimmed.startsWith('sk-')) {
        setError('API key should start with "sk-".');
        return;
      }

      setApiKey(trimmed);
      onSubmit(trimmed);
    },
    [key, onSubmit],
  );

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-zinc-200 text-center mb-1">
            OpenAI API Key
          </h2>
          <p className="text-[11px] text-zinc-500 text-center mb-4">
            Enter your OpenAI API key to use GPT-5.4 Mini for code generation.
            Your key is stored locally in your browser.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError('');
              }}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/25"
              autoFocus
            />
            {error && (
              <p className="mt-1.5 text-[10px] text-red-400">{error}</p>
            )}
            <button
              type="submit"
              className="mt-3 w-full py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors"
            >
              Connect to GPT-5.4 Mini
            </button>
          </form>

          <p className="mt-3 text-[10px] text-zinc-600 text-center">
            Get your API key at{' '}
            <span className="text-green-400/70">platform.openai.com</span>
          </p>
        </div>
      </div>
    </div>
  );
}

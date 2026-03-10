import { useState, useCallback } from 'react';

const API_KEY_STORAGE_KEY = 'jiki-anthropic-api-key';

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

interface ApiKeyModalProps {
  onSubmit: (key: string) => void;
}

export function ApiKeyModal({ onSubmit }: ApiKeyModalProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = key.trim();

      if (!trimmed) {
        setError('Please enter your API key.');
        return;
      }

      if (!trimmed.startsWith('sk-ant-')) {
        setError('API key should start with "sk-ant-".');
        return;
      }

      setApiKey(trimmed);
      onSubmit(trimmed);
    },
    [key, onSubmit],
  );

  return (
    <div className="h-full flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-4">
              <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-1">Anthropic API Key</h2>
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Enter your API key to start generating React components with Claude Opus 4.6.
              Your key is stored locally in your browser.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError('');
                }}
                placeholder="sk-ant-..."
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-[13px] text-zinc-200 font-mono outline-none placeholder:text-zinc-600 focus:border-blue-500/50 transition-colors"
              />
              {error && (
                <p className="mt-1.5 text-[12px] text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Start Building
            </button>

            <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
              API calls are made directly from your browser to Anthropic. Your key never leaves your machine.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

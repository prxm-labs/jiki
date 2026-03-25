import { useRef, useEffect } from 'react';
import type { HMREvent } from '../hooks/useNextContainer';

interface Props {
  events: HMREvent[];
  onClear: () => void;
}

export function HMRLog({ events, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${events.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">HMR</span>
          </div>
          {events.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              {events.length}
            </span>
          )}
        </div>
        <button onClick={onClear} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Clear
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-1.5 font-mono text-[11px] leading-5">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 text-[10px]">
            Edit a file to trigger HMR events
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex items-start gap-2 py-0.5">
              <span className="text-zinc-600 flex-shrink-0 w-[52px] text-right">
                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span
                className={`flex-shrink-0 px-1.5 py-0 rounded text-[10px] font-medium ${
                  event.type === 'update'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {event.type === 'update' ? 'HMR' : 'RELOAD'}
              </span>
              <span className="text-zinc-400 truncate">{event.path}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

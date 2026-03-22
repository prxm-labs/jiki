import type { TestResult } from '../useTestRunner';

interface Props {
  results: TestResult[];
  isRunning: boolean;
}

export function TestResults({ results, isRunning }: Props) {
  if (isRunning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
          <p className="mt-2 text-xs text-zinc-500">Running tests...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-zinc-600">
          <p className="text-sm">No test results yet</p>
          <p className="text-xs mt-1">Click "Run Tests" to execute the test suite</p>
        </div>
      </div>
    );
  }

  const suites = new Map<string, TestResult[]>();
  for (const r of results) {
    const existing = suites.get(r.suite) || [];
    existing.push(r);
    suites.set(r.suite, existing);
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const allPassed = failed === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Test Results
        </span>
        <div className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${allPassed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {passed}/{results.length} passed
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Array.from(suites.entries()).map(([suite, tests]) => {
          const suitePassed = tests.every((t) => t.status === 'pass');
          return (
            <div key={suite} className="rounded-lg border border-zinc-800 overflow-hidden">
              <div className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${suitePassed ? 'bg-emerald-500/5 text-emerald-300' : 'bg-red-500/5 text-red-300'}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${suitePassed ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {suite}
              </div>
              <div className="divide-y divide-zinc-800/50">
                {tests.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-[12px]">
                    <span className={`mt-0.5 flex-shrink-0 ${t.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.status === 'pass' ? '\u2713' : '\u2717'}
                    </span>
                    <div className="min-w-0">
                      <span className={t.status === 'pass' ? 'text-zinc-300' : 'text-red-300'}>
                        {t.name}
                      </span>
                      {t.error && (
                        <div className="mt-0.5 text-[11px] text-red-400/70 font-mono truncate">
                          {t.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-800 text-[11px] text-zinc-600">
        <span>{suites.size} suites, {results.length} tests</span>
        <span className={allPassed ? 'text-emerald-500' : 'text-red-400'}>
          {allPassed ? 'All tests passed' : `${failed} test${failed > 1 ? 's' : ''} failed`}
        </span>
      </div>
    </div>
  );
}

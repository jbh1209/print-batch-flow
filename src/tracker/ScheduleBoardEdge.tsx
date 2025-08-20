// src/tracker/schedule-board/ScheduleBoardEdge.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type ApiResult = { ok: boolean; scheduled: number; applied?: any; updates: { id: string; start_at: string; end_at: string; minutes: number }[] };

export default function ScheduleBoardEdge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  const [commit, setCommit] = useState(false);
  const [proposed, setProposed] = useState(true);
  const [onlyUnset, setOnlyUnset] = useState(true);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('scheduler-run', { body: { commit, proposed, onlyIfUnset: onlyUnset } });
      if (error) throw error;
      setResult(data as ApiResult);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const updated = result?.applied?.updated ?? 0;
  const skippedManual = result?.applied?.skipped_manual ?? 0;
  const skippedInProgress = result?.applied?.skipped_inprogress ?? 0;
  const skippedExists = result?.applied?.skipped_exists ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedule Board</h1>
          <p className="text-sm text-gray-500">Server-side scheduler (Edge Function). Lunch 13:00–13:30, proof-gated, dependency-aware.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={commit} onChange={e=>setCommit(e.target.checked)} /> Commit</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={proposed} onChange={e=>setProposed(e.target.checked)} /> As proposed</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyUnset} onChange={e=>setOnlyUnset(e.target.checked)} /> Only unset</label>
          <button onClick={run} className="px-3 py-2 rounded-md border hover:bg-gray-50">{loading ? 'Running…' : 'Reschedule All'}</button>
        </div>
      </div>

      {error && <div className="text-red-600">Error: {error}</div>}

      {result && (
        <div className="space-y-3">
          <div className="border rounded-md p-3">
            <div className="font-medium">Result totals</div>
            <div className="text-sm text-gray-700">
              Planned: <b>{result.scheduled}</b> stages
              {commit && <>
                {' '}| Applied: <b>{updated}</b>
                {' '}| Skipped (manual): <b>{skippedManual}</b>
                {' '}| Skipped (in_progress): <b>{skippedInProgress}</b>
                {' '}| Skipped (already set): <b>{skippedExists}</b>
              </>}
            </div>
          </div>
          <div className="border rounded-md overflow-hidden">
            <div className="p-2 bg-gray-50 border-b text-sm">Sample of updates (first 50)</div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr>
                    <th className="text-left p-2">Stage Instance</th>
                    <th className="text-left p-2">Start</th>
                    <th className="text-left p-2">End</th>
                    <th className="text-left p-2">Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.updates.slice(0,50).map(u => (
                    <tr key={u.id} className="border-t">
                      <td className="p-2 font-mono">{u.id}</td>
                      <td className="p-2">{new Date(u.start_at).toLocaleString()}</td>
                      <td className="p-2">{new Date(u.end_at).toLocaleString()}</td>
                      <td className="p-2">{u.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

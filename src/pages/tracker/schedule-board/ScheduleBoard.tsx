// tracker/schedule-board/ScheduleBoard.tsx
import React, { useEffect, useState } from 'react';
import { ScheduleRepairPanel } from "@/components/tracker/schedule-board/ScheduleRepairPanel";

type Update = { id: string; start_at: string; end_at: string; minutes: number };
type ApiResponse = { ok: boolean; scheduled: number; applied?: any; updates: Update[] };

export default function ScheduleBoard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commit, setCommit] = useState(true);
  const [proposed, setProposed] = useState(true);
  const [onlyUnset, setOnlyUnset] = useState(true);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams({ commit: String(commit), proposed: String(proposed), onlyIfUnset: String(onlyUnset) }).toString();
      const resp = await fetch('/api/scheduler/run?' + q);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Failed');
      setData(json);
    } catch (e:any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { /* initial dry-run preview */ setCommit(false); setProposed(true); setOnlyUnset(true); }, []);

  return (
    <div className="p-6 space-y-4">
      {/* Emergency Repair Panel */}
      <ScheduleRepairPanel />
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Production Schedule</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={commit} onChange={e=>setCommit(e.target.checked)} /> Commit</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={proposed} onChange={e=>setProposed(e.target.checked)} /> As proposed</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyUnset} onChange={e=>setOnlyUnset(e.target.checked)} /> Only unset</label>
          <button onClick={run} className="px-3 py-2 rounded-md border hover:bg-gray-50">{loading ? 'Running…' : 'Run Scheduler'}</button>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      {data && <UpdatesTable data={data} />}
      <p className="text-xs text-gray-500">Tip: start in dry-run (Commit unchecked). When happy, tick Commit. \"As proposed\" writes schedule_status='proposed' instead of 'scheduled'.</p>
    </div>
  );
}

function UpdatesTable({ data }: { data: ApiResponse }) {
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="p-2 bg-gray-50 border-b text-sm">Planned {data.scheduled} stages {data.applied && `(applied: ${data.applied.updated ?? 0})`}</div>
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
            {data.updates.map(u => (
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
  );
}

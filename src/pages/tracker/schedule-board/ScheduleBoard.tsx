// tracker/schedule-board/ScheduleBoard.tsx
import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

type DbSchedulerResult = { 
  ok?: boolean; 
  success?: boolean;
  wrote_slots: number; 
  updated_jsi: number; 
  violations: Array<{ 
    job_id: string; 
    violation_type: string; 
    stage1_name: string;
    stage2_name: string;
    violation_details: string;
  }> 
};

export default function ScheduleBoard() {
  const [data, setData] = useState<DbSchedulerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDbScheduler = async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('simple-scheduler', {
        body: { commit: true, proposed: false, onlyIfUnset: false }
      });
      if (error) throw new Error(error.message || 'Scheduler failed');
      setData(data as DbSchedulerResult);
    } catch (e:any) {
      setError(e.message ?? String(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Production Schedule (Oct 24 DB Engine)</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={runDbScheduler} 
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium"
            disabled={loading}
          >
            {loading ? 'Running DB Scheduler…' : 'DB Reschedule (FIFO)'}
          </button>
        </div>
      </div>
      {error && <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200">{error}</div>}
      {data && <ResultsPanel data={data} />}
      <p className="text-xs text-gray-500">
        Using Oct 24 database scheduler: proper FIFO per job with per-resource queues. 
        Stages schedule sequentially within each job, respecting proof_approved_at order.
      </p>
    </div>
  );
}

function ResultsPanel({ data }: { data: DbSchedulerResult }) {
  return (
    <div className="border rounded-md overflow-hidden bg-white">
      <div className="p-3 bg-gray-50 border-b">
        <div className="text-sm font-medium">
          ✅ Wrote {data.wrote_slots} time slots, updated {data.updated_jsi} stage instances
        </div>
        {data.violations && data.violations.length > 0 && (
          <div className="mt-2 text-sm text-amber-700">
            ⚠️ {data.violations.length} precedence notes (review if unexpected)
          </div>
        )}
      </div>
      {data.violations && data.violations.length > 0 && (
        <div className="p-3 space-y-2 max-h-[40vh] overflow-auto">
          <div className="text-xs font-medium text-gray-600">Validation Notes:</div>
          {data.violations.map((v, idx) => (
            <div key={idx} className="p-2 bg-amber-50 rounded text-xs border border-amber-200">
              <div className="font-mono text-gray-700">{v.job_id}</div>
              <div className="text-gray-600">{v.violation_type}: {v.stage1_name} → {v.stage2_name}</div>
              <div className="text-gray-500">{v.violation_details}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

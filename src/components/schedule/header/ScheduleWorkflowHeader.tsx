// src/components/schedule/header/ScheduleWorkflowHeader.tsx
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase'; // <-- adjust path if needed

type Props = {
  onRefresh?: () => Promise<void> | void;   // parent can pass a reloader
  className?: string;
};

export default function ScheduleWorkflowHeader({ onRefresh, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [lastSummary, setLastSummary] = useState<null | {
    updated: number;
    baseStart?: string;
  }>(null);

  const handleRefresh = async () => {
    try {
      if (onRefresh) await onRefresh();
      else window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  // Nuclear reset: wipe auto schedule from the next working day and rebuild everything
  const handleRescheduleAll = async () => {
    const ok = window.confirm(
      'Nuclear reschedule:\n\n' +
      '• Clears auto-scheduled times from the next working day\n' +
      '• Rebuilds the schedule for all approved orders\n\n' +
      'Proceed?'
    );
    if (!ok) return;

    setBusy(true);
    setLastSummary(null);

    try {
      const payload = {
        commit: true,
        proposed: false,
        onlyIfUnset: false,                     // overwrite
        nuclear: true,                          // wipe + rebuild
        startFrom: new Date().toISOString().slice(0, 10), // today; server shifts to next work window
        // wipeAll: true,                       // OPTIONAL: uncomment to wipe past placements too
      };

      const { data, error } = await supabase.functions.invoke('scheduler-run', { body: payload });
      if (error) throw error;

      const updated = data?.applied?.updated ?? 0;
      const baseStart = data?.baseStart as string | undefined;
      setLastSummary({ updated, baseStart });

      // Optionally toast UI; keeping console/alert for simplicity
      console.log('Reschedule result:', data);
      alert(`Rescheduled ${updated} stages${baseStart ? ` (from ${baseStart.slice(0,10)})` : ''}.`);

      await handleRefresh();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to reschedule: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className ?? ''} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        className="btn btn-light"
        onClick={handleRefresh}
        disabled={busy}
        title="Reload the current week"
      >
        Refresh
      </button>

      <button
        type="button"
        className="btn btn-dark"
        onClick={handleRescheduleAll}
        disabled={busy}
        title="Wipe & rebuild schedule from next working day"
      >
        {busy ? 'Rescheduling…' : 'Reschedule All'}
      </button>

      {lastSummary && (
        <span
          style={{
            marginLeft: 8,
            padding: '2px 8px',
            fontSize: 12,
            borderRadius: 12,
            background: '#eef3ff',
            color: '#1f3a8a'
          }}
          title={lastSummary.baseStart ? `Base start: ${lastSummary.baseStart}` : 'Reschedule result'}
        >
          {lastSummary.updated} updated
          {lastSummary.baseStart ? ` • from ${lastSummary.baseStart.slice(0, 10)}` : ''}
        </span>
      )}
    </div>
  );
}

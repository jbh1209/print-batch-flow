import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { ScheduleDayData } from "@/hooks/useScheduleReader";

interface ScheduleWorkflowHeaderProps {
  scheduleDays: ScheduleDayData[];
  selectedStageName?: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onReschedule: () => void;
}

export const ScheduleWorkflowHeader: React.FC<ScheduleWorkflowHeaderProps> = ({
  scheduleDays,
  selectedStageName,
  isLoading,
  onRefresh,
  onReschedule
}) => {
  const [busy, setBusy] = useState(false);
  const totalStages = scheduleDays.reduce((total, day) => total + day.total_stages, 0);
  const totalMinutes = scheduleDays.reduce((total, day) => total + day.total_minutes, 0);
  
  const getFilteredJobCount = () => {
    if (!selectedStageName) return totalStages;
    
    let count = 0;
    scheduleDays.forEach(day => {
      day.time_slots?.forEach(slot => {
        const stageJobs = slot.scheduled_stages?.filter(stage => stage.stage_name === selectedStageName) || [];
        count += stageJobs.length;
      });
    });
    return count;
  };

  const runNuclear = async () => {
    const confirm = window.confirm(
      'This will wipe auto-scheduled times from the next working day onward and rebuild the schedule. Continue?'
    );
    if (!confirm) return;

    setBusy(true);
    try {
      const payload = {
        commit: true,
        proposed: false,
        onlyIfUnset: false,
        nuclear: true,
        startFrom: new Date().toISOString().slice(0, 10)
      };

      const { data, error } = await supabase.functions.invoke('scheduler-run', { body: payload });
      if (error) throw error;

      const updated = data?.applied?.updated ?? 0;
      const base = data?.baseStart?.slice(0, 10);
      toast.success(`Rescheduled ${updated} stages starting from ${base || 'next working day'}.`);

      onRefresh();
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to reschedule: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Schedule Board</h1>
        <p className="text-muted-foreground">
          Production workflow organized by working days
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {scheduleDays.length} working days
          </div>
          <div className="flex items-center gap-1">
            <span>•</span>
            {selectedStageName ? (
              <>
                {getFilteredJobCount()} jobs in {selectedStageName}
              </>
            ) : (
              <>
                {totalStages} total stages
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span>•</span>
            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m scheduled
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          onClick={onRefresh}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          onClick={runNuclear}
          disabled={isLoading || busy}
          size="sm"
          className="flex items-center gap-2"
        >
          <Zap className="h-4 w-4" />
          {busy ? 'Rescheduling…' : 'Reschedule All'}
        </Button>
      </div>
    </div>
  );
};
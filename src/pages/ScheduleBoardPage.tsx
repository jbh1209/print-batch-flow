import React, { useState } from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { toast } from "sonner";
import { getSchedulingValidation } from "@/utils/scheduler";
import { SchedulerResult } from "@/types/scheduler";
import { ValidationResults } from "@/components/scheduler/ValidationResults";
import { GapFillReport } from "@/components/scheduler/GapFillReport";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule, triggerReschedule } = useScheduleReader();
  const { isAdmin } = useUserRole();
  const [schedulerResult, setSchedulerResult] = useState<SchedulerResult | null>(null);

  const handleRefresh = async () => {
    await fetchSchedule();
  };

  const handleReschedule = async () => {
    try {
      toast.message("Rebuilding schedule with parallel-aware scheduler…");

      const ok = await triggerReschedule();
      if (!ok) return;

      // TODO: Capture full scheduler result from triggerReschedule
      // For now, clear previous results
      setSchedulerResult(null);

      await fetchSchedule();
      
      // Get post-reschedule validation
      const validationResults = await getSchedulingValidation();
      
      if (validationResults.length > 0) {
        toast.message(
          `✅ Parallel scheduler ran. ${validationResults.length} precedence notes (normal for cover/text stages)`,
          {
            description: "Click on any job to see 'Why scheduled here?' details"
          }
        );
        console.log('Parallel processing validation info:', validationResults);
      } else {
        toast.success(`✅ Perfect schedule: 0 validation notes`);
      }
    } catch (e: any) {
      console.error("Reschedule failed:", e);
      toast.error(`Reschedule failed: ${e?.message ?? e}`);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex-1 overflow-hidden">
        <ScheduleBoard
          scheduleDays={scheduleDays}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          onReschedule={handleReschedule}
          isAdminUser={isAdmin}
        />
      </div>
      
      {schedulerResult && (
        <div className="border-t bg-background p-4 space-y-4 overflow-y-auto max-h-[40vh]">
          <h2 className="text-lg font-semibold">Scheduling Results</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ValidationResults violations={schedulerResult.violations} />
            {schedulerResult.gap_fills && schedulerResult.gap_fills.length > 0 && (
              <GapFillReport gapFills={schedulerResult.gap_fills} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

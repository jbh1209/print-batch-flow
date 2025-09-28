import React from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { toast } from "sonner";
import { rescheduleAll, getSchedulingValidation } from "@/utils/scheduler";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule } = useScheduleReader();
  const { isAdmin } = useUserRole();

  const handleRefresh = async () => {
    await fetchSchedule();
  };

  const handleReschedule = async () => {
    try {
      toast.message("Rebuilding schedule with parallel-aware scheduler…");

      const result = await rescheduleAll();
      if (!result) return;

      await fetchSchedule();
      
      // Get post-reschedule validation
      const validationResults = await getSchedulingValidation();
      
      if (validationResults.length > 0) {
        toast.message(
          `✅ Scheduled ${result.updated_jsi} stages with ${result.wrote_slots} slots. ${validationResults.length} parallel processing info items (normal for cover/text stages)`,
          {
            description: "Click on any job to see 'Why scheduled here?' details"
          }
        );
        console.log('Parallel processing validation info:', validationResults);
      } else {
        toast.success(
          `✅ Perfect schedule: ${result.updated_jsi} stages with ${result.wrote_slots} slots, 0 validation notes`
        );
      }
    } catch (e: any) {
      console.error("Reschedule failed:", e);
      toast.error(`Reschedule failed: ${e?.message ?? e}`);
    }
  };

  return (
    <ScheduleBoard
      scheduleDays={scheduleDays}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      onReschedule={handleReschedule}
      isAdminUser={isAdmin}
    />
  );
}

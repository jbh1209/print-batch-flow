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
        toast.warning(
          `Scheduled ${result.updated_jsi} stages with ${result.wrote_slots} slots. ${validationResults.length} precedence info items (some may be normal for parallel processing)`
        );
        console.log('Scheduling validation info:', validationResults);
      } else {
        toast.success(
          `✅ Perfect schedule: ${result.updated_jsi} stages with ${result.wrote_slots} slots, 0 precedence issues`
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

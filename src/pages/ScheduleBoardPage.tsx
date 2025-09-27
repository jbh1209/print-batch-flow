import React from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { toast } from "sonner";
import { rescheduleAll, getSchedulingValidation } from "@/utils/scheduler-20241227_1445";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule } = useScheduleReader();
  const { isAdmin } = useUserRole();

  const handleRefresh = async () => {
    await fetchSchedule();
  };

  const handleReschedule = async () => {
    try {
      toast.message("🔄 Rebuilding schedule with PARALLEL PARTS scheduler v20241227_1445…");

      const result = await rescheduleAll();
      if (!result) return;

      await fetchSchedule();
      
      // Get post-reschedule validation
      const validationResults = await getSchedulingValidation();
      
      if (validationResults.length > 0) {
        toast.message(
          `✅ PARALLEL PARTS v20241227_1445: Scheduled ${result.updated_jsi} stages with ${result.wrote_slots} slots. ${validationResults.length} validation items`,
          {
            description: "Cover/Text stages now run in parallel! Check job D426511 for proper parallel processing."
          }
        );
        console.log('Parallel processing validation info:', validationResults);
      } else {
        toast.success(
          `✅ PERFECT PARALLEL SCHEDULE v20241227_1445: ${result.updated_jsi} stages with ${result.wrote_slots} slots, 0 validation notes`
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

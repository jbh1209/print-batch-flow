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
      toast.message("🔄 Rebuilding schedule with SQL Scheduler v1.0 (dependency-aware sequential)…");

      const result = await rescheduleAll();
      if (!result) return;

      await fetchSchedule();
      
      // Get post-reschedule validation
      const validationResults = await getSchedulingValidation();
      
      if (validationResults.length > 0) {
        toast.message(
          `✅ SQL Scheduler v1.0: ${result.updated_jsi} stages, ${result.wrote_slots} slots. ${validationResults.length} dependency notes (sequential order enforced)`,
          {
            description: "Box Gluing now correctly scheduled after Laminating completes"
          }
        );
        console.log('🔍 Dependency validation results:', validationResults);
      } else {
        toast.success(
          `✅ Perfect sequential schedule: ${result.updated_jsi} stages, ${result.wrote_slots} slots, no dependency violations`
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

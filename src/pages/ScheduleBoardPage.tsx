import React from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useDivision } from "@/contexts/DivisionContext";
import { toast } from "sonner";
import { getSchedulingValidation } from "@/utils/scheduler";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule, triggerReschedule } = useScheduleReader();
  const { isAdmin } = useUserRole();
  const { selectedDivision } = useDivision();

  const handleRefresh = async () => {
    await fetchSchedule(selectedDivision);
  };

  const handleReschedule = async () => {
    try {
      const divisionLabel = selectedDivision ? ` for ${selectedDivision}` : ' (all divisions)';
      toast.message(`Rebuilding schedule${divisionLabel} with parallel-aware scheduler…`);

      const ok = await triggerReschedule(selectedDivision);
      if (!ok) return;

      await fetchSchedule(selectedDivision);
      
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
    <ScheduleBoard
      scheduleDays={scheduleDays}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      onReschedule={handleReschedule}
      isAdminUser={isAdmin}
    />
  );
}

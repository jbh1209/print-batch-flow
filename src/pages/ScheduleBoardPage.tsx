import React from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { toast } from "sonner";
import { getSchedulingValidation } from "@/utils/scheduler";
import { supabase } from "@/integrations/supabase/client";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule, triggerReschedule } = useScheduleReader();
  const { isAdmin } = useUserRole();

  const handleRefresh = async () => {
    await fetchSchedule();
  };

  const handleReschedule = async () => {
    try {
      toast.message("Rebuilding schedule with Oct 24 scheduler (FIFO, proof-approved)…");

      // Full reschedule using Oct 24 scheduler
      const { data, error } = await supabase.functions.invoke('scheduler-run', {
        body: {
          commit: true,
          proposed: false,
          onlyIfUnset: false,
          wipeAll: false, // Oct 24 scheduler clears non-completed slots automatically
          onlyJobIds: null // Trigger full reschedule
        }
      });

      if (error) {
        throw new Error(error.message || 'Reschedule failed');
      }

      await fetchSchedule();
      
      // Get post-reschedule validation
      const validationResults = await getSchedulingValidation();
      
      const wroteSlots = data?.wrote_slots ?? 0;
      const updatedJsi = data?.updated_jsi ?? 0;
      
      if (validationResults.length > 0) {
        toast.message(
          `✅ Oct 24 scheduler ran: ${wroteSlots} slots, ${updatedJsi} stages. ${validationResults.length} precedence notes`,
          {
            description: "Click on any job to see 'Why scheduled here?' details"
          }
        );
        console.log('Scheduling validation info:', validationResults);
      } else {
        toast.success(`✅ Perfect schedule: ${wroteSlots} slots, ${updatedJsi} stages, 0 validation notes`);
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

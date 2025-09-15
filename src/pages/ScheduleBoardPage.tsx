import React from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { supabase } from "@/integrations/supabase/client";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { toast } from "sonner";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule } = useScheduleReader();
  const { isAdmin } = useUserRole();

  const handleRefresh = async () => {
    await fetchSchedule();
  };

  const handleReschedule = async () => {
    try {
      try { toast.message?.("Rebuilding schedule…"); } catch {}

      // Use the scheduler-run edge function to avoid browser timeout limits
      const { data, error } = await supabase.functions.invoke('scheduler-run', {
        body: { 
          commit: true, 
          onlyIfUnset: false  // Full reschedule
        }
      });

      if (error) {
        console.error("scheduler-run error:", error);
        try { toast.error?.(`Reschedule failed: ${error.message}`); } catch {}
        throw error;
      }

      console.log("scheduler-run response:", data);
      await fetchSchedule();
      
      // Handle the scheduler-run response format
      const scheduledCount = data?.updatedJSI ?? 0;
      const wroteSlots = data?.wroteSlots ?? 0;
      
      try { toast.success?.(`Rescheduled ${scheduledCount} stages with ${wroteSlots} time slots`); } catch {}
    } catch (e: any) {
      console.error("Reschedule failed:", e);
      try { toast.error?.(`Reschedule failed: ${e?.message ?? e}`); } catch {}
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

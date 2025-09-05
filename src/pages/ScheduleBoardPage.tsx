import React from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { supabase } from "@/integrations/supabase/client";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { toast } from "sonner";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule } = useScheduleReader();

  const handleRefresh = async () => {
    await fetchSchedule();
  };

  const handleReschedule = async () => {
    try {
      try { toast.message?.("Rebuilding schedule…"); } catch {}

      const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
        p_mode: 'reschedule_all' // Use the persistent queue scheduler with DTP/Proof exclusions
      });

      if (error) {
        console.error("simple_scheduler_wrapper error:", error);
        try { toast.error?.(`Reschedule failed: ${error.message}`); } catch {}
        throw error;
      }

      console.log("simple_scheduler_wrapper response:", data);
      await fetchSchedule();
      
      // Handle the wrapper's jsonb response format
      const result = data as any;
      const scheduledCount = result?.scheduled_count ?? 0;
      const wroteSlots = result?.wrote_slots ?? 0;
      
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
    />
  );
}

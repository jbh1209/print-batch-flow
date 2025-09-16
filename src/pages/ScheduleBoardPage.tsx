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

      // Directly call RPC to bypass Edge Function time limits
      const { data, error } = await supabase.rpc('scheduler_reschedule_all_parallel_aware_edge');

      if (error) {
        console.error('Reschedule RPC error:', error);
        try { toast.error?.(`Reschedule failed: ${error.message}`); } catch {}
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      await fetchSchedule();
      
      const scheduledCount = row?.updated_jsi ?? 0;
      const wroteSlots = row?.wrote_slots ?? 0;
      
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

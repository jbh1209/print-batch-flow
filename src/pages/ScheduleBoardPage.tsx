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
      // Optional UX
      try { toast.message?.("Rebuilding schedule…"); } catch {}

      // today; the Edge Function will shift to the NEXT working day's first window
      const startFrom = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase.functions.invoke("scheduler-run", {
        body: {
          commit: true,
          proposed: false,
          onlyIfUnset: false,
          nuclear: true,
          startFrom,     // yyyy-mm-dd
          wipeAll: true, // ask the RPC to wipe auto slots before planning
        },
      });

      if (error) throw error;
      console.log("scheduler-run response:", data);

      await fetchSchedule();
      try { toast.success?.(`Rescheduled ${data?.scheduled ?? 0} stages`); } catch {}
    } catch (e) {
      console.error("Reschedule failed:", e);
      try { toast.error?.("Reschedule failed"); } catch {}
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
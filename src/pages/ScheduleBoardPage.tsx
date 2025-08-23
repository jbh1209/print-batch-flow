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

      // Local YYYY-MM-DD; the Edge Function moves to the next working day's first window
      const startFrom = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase.functions.invoke("scheduler-run", {
        body: {
          commit: true,
          proposed: false,
          onlyIfUnset: false,
          nuclear: true,
          startFrom,    // yyyy-mm-dd
          wipeAll: true // ask the DB to clear auto slots before planning
        },
      });

      // Surface the real server error body if present
      if (error) {
        const resp: Response | undefined = (error as any)?.context?.response;
        if (resp) {
          const text = await resp.text();
          console.error("scheduler-run error body:", text);
          try { toast.error?.(`Reschedule failed: ${text}`); } catch {}
        }
        throw error;
      }

      console.log("scheduler-run response:", data);
      await fetchSchedule();
      try { toast.success?.(`Rescheduled ${data?.scheduled ?? 0} stages`); } catch {}
    } catch (e: any) {
      console.error("Reschedule failed:", e);
      if (!e?.context?.response) {
        try { toast.error?.(`Reschedule failed: ${e?.message ?? e}`); } catch {}
      }
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

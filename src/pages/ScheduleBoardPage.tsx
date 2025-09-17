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

      const { data, error } = await supabase.rpc('scheduler_reschedule_all_sequential_fixed');

      if (error) {
        console.error("scheduler_reschedule_all_sequential_fixed error:", error);
        try { toast.error?.(`Reschedule failed: ${error.message}`); } catch {}
        throw error;
      }

      console.log("scheduler_reschedule_all_sequential_fixed response:", data);
      await fetchSchedule();
      
      // Handle the sequential_fixed function response format
      const result = (data as any)?.[0] || {};
      const wroteSlots = (result as any)?.wrote_slots ?? 0;
      const updatedJSI = (result as any)?.updated_jsi ?? 0;
      
      // Normalize violations - could be string, array, or object from jsonb
      let violations = [];
      if ((result as any)?.violations) {
        const violationsData = (result as any).violations;
        if (Array.isArray(violationsData)) {
          violations = violationsData;
        } else if (typeof violationsData === 'string') {
          try {
            violations = JSON.parse(violationsData);
          } catch {
            violations = [];
          }
        } else if (typeof violationsData === 'object') {
          violations = [violationsData];
        }
      }
      
      if (violations.length > 0) {
        try { toast.warning?.(`Scheduled ${updatedJSI} stages with ${wroteSlots} slots, but ${violations.length} precedence violations detected`); } catch {}
      } else {
        try { toast.success?.(`Successfully scheduled ${updatedJSI} stages with ${wroteSlots} time slots`); } catch {}
      }
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

import React from "react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useChunkedScheduler } from "@/hooks/useChunkedScheduler";
import { toast } from "sonner";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule } = useScheduleReader();
  const { isAdmin } = useUserRole();
  const { rescheduleAllChunked, isLoading: isRescheduling } = useChunkedScheduler();

  const handleRefresh = async () => {
    await fetchSchedule();
  };

  const handleReschedule = async () => {
    try {
      const { totals, progress } = await rescheduleAllChunked();
      
      await fetchSchedule();
      
      if (progress.failed > 0) {
        toast.warning(`Rescheduled ${totals.updated_jsi} stages (${totals.wrote_slots} slots), but ${progress.failed} jobs failed`);
      } else {
        toast.success(`Rescheduled ${totals.updated_jsi} stages with ${totals.wrote_slots} time slots`);
      }
    } catch (error: any) {
      console.error("Reschedule failed:", error);
      toast.error(`Reschedule failed: ${error?.message ?? error}`);
    }
  };

  return (
    <ScheduleBoard
      scheduleDays={scheduleDays}
      isLoading={isLoading || isRescheduling}
      onRefresh={handleRefresh}
      onReschedule={handleReschedule}
      isAdminUser={isAdmin}
    />
  );
}

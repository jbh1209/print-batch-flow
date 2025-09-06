import { useState } from "react";
import { DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@/utils/tracker/reorderUtils";
import type { ScheduledStageData } from "@/hooks/useScheduleReader";

interface UseScheduleDnDContextProps {
  onReorderStages: (
    date: string,
    newStageOrder: ScheduledStageData[]
  ) => Promise<void>;
  isAdminUser?: boolean;
}

export function useScheduleDnDContext({ 
  onReorderStages, 
  isAdminUser = false 
}: UseScheduleDnDContextProps) {
  const [isReordering, setIsReordering] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 5 
      } 
    })
  );

  const onDragEnd = async (event: DragEndEvent, allDayStages: ScheduledStageData[], date: string) => {
    const { active, over } = event;
    
    if (!active || !over || !isAdminUser) return;
    if (active.id === over.id) return;

    const activeStageId = active.id as string;
    const overStageId = over.id as string;

    // Find the indices of the active and over stages
    const activeIndex = allDayStages.findIndex(stage => stage.id === activeStageId);
    const overIndex = allDayStages.findIndex(stage => stage.id === overStageId);

    if (activeIndex === -1 || overIndex === -1) return;

    // Check if we're trying to move a cross-day split job (prevent moving split jobs)
    const activeStage = allDayStages[activeIndex];
    const isSplitJob = activeStage.is_split_job;
    
    if (isSplitJob) {
      console.warn("Cannot reorder split jobs that span across days");
      return;
    }

    // Create the new order using the arrayMove utility
    const reorderedStages = arrayMove(allDayStages, activeIndex, overIndex);

    try {
      setIsReordering(true);
      await onReorderStages(date, reorderedStages);
    } catch (error) {
      console.error("Failed to reorder stages:", error);
      // TODO: Show error toast
    } finally {
      setIsReordering(false);
    }
  };

  return {
    sensors,
    onDragEnd,
    isReordering,
    isAdminUser
  };
}
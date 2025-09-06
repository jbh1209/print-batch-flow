import { useState } from "react";
import { DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@/utils/tracker/reorderUtils";
import type { ScheduledStageData } from "@/hooks/useScheduleReader";

interface UseScheduleDnDContextProps {
  onReorderStages: (
    date: string,
    timeSlot: string,
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

  const onDragEnd = async (event: DragEndEvent, timeSlotStages: ScheduledStageData[], date: string, timeSlot: string) => {
    const { active, over } = event;
    
    if (!active || !over || !isAdminUser) return;
    if (active.id === over.id) return;

    const activeStageId = active.id as string;
    const overStageId = over.id as string;

    // Find the indices of the active and over stages
    const activeIndex = timeSlotStages.findIndex(stage => stage.id === activeStageId);
    const overIndex = timeSlotStages.findIndex(stage => stage.id === overStageId);

    if (activeIndex === -1 || overIndex === -1) return;

    // Check if we're trying to move a split job (prevent moving split jobs for now)
    const activeStage = timeSlotStages[activeIndex];
    // TODO: Add is_split_job to ScheduledStageData interface when available
    const isSplitJob = false; // activeStage.is_split_job;
    
    if (isSplitJob) {
      console.warn("Cannot reorder split jobs within shifts");
      return;
    }

    // Create the new order using the arrayMove utility
    const reorderedStages = arrayMove(timeSlotStages, activeIndex, overIndex);
    
    // Ensure split jobs remain at the end (when split job detection is implemented)
    // const nonSplitStages = reorderedStages.filter(stage => !stage.is_split_job);
    // const splitStages = reorderedStages.filter(stage => stage.is_split_job);
    const finalOrder = reorderedStages; // [...nonSplitStages, ...splitStages];

    try {
      setIsReordering(true);
      await onReorderStages(date, timeSlot, finalOrder);
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
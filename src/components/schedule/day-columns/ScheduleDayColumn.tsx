import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableScheduleStageCard } from "./SortableScheduleStageCard";
import { useScheduleDnDContext } from "./useScheduleDnDContext";
import type { ScheduleDayData, ScheduledStageData } from "@/hooks/useScheduleReader";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleDayColumnProps {
  day: ScheduleDayData;
  selectedStageId?: string | null;
  selectedStageName?: string | null;
  onJobClick?: (stage: ScheduledStageData) => void;
  isAdminUser?: boolean;
  onScheduleUpdate?: () => void;
}

export const ScheduleDayColumn: React.FC<ScheduleDayColumnProps> = ({
  day,
  selectedStageId,
  selectedStageName,
  onJobClick,
  isAdminUser = false,
  onScheduleUpdate
}) => {
  // Filter stages based on selected stage
  const filteredTimeSlots = React.useMemo(() => {
    if (!selectedStageId) return day.time_slots || [];
    
    return (day.time_slots || []).map(slot => ({
      ...slot,
      scheduled_stages: (slot.scheduled_stages || []).filter(stage => 
        stage.production_stage_id === selectedStageId
      )
    })).filter(slot => slot.scheduled_stages && slot.scheduled_stages.length > 0);
  }, [day.time_slots, selectedStageId]);

  const dayTotalJobs = React.useMemo(() => {
    return filteredTimeSlots.reduce((total, slot) => 
      total + (slot.scheduled_stages?.length || 0), 0
    );
  }, [filteredTimeSlots]);

  const dayTotalMinutes = React.useMemo(() => {
    return filteredTimeSlots.reduce((total, slot) => 
      total + (slot.scheduled_stages?.reduce((stageTotal, stage) => 
        stageTotal + (stage.estimated_duration_minutes || 0), 0
      ) || 0), 0
    );
  }, [filteredTimeSlots]);

  // Handler for reordering stages across the entire day
  const handleReorderStages = async (
    date: string,
    newStageOrder: ScheduledStageData[]
  ) => {
    try {
      const stageIds = newStageOrder.map(stage => stage.id);
      
      const { error } = await supabase.functions.invoke('schedule-reorder-shift', {
        body: {
          date,
          stageIds,
          dayWideReorder: true,
          shiftStartTime: '08:00',
          shiftEndTime: '17:00'
        }
      });
      
      if (error) {
        console.error('Error reordering stages:', error);
        throw error;
      }

      // Refresh the schedule data
      if (onScheduleUpdate) {
        onScheduleUpdate();
      }
    } catch (error) {
      console.error('Failed to reorder stages:', error);
      throw error;
    }
  };

  // Flatten all stages from all time slots for day-wide dragging
  const allDayStages = React.useMemo(() => {
    return filteredTimeSlots.flatMap(slot => slot.scheduled_stages || []);
  }, [filteredTimeSlots]);

  const { sensors, onDragEnd, isReordering } = useScheduleDnDContext({
    onReorderStages: handleReorderStages,
    isAdminUser
  });

  return (
    <div className="flex-1 min-w-[300px] max-w-[400px]">
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(day.date), 'EEE, MMM d')}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {dayTotalJobs} jobs
              </Badge>
              <Badge variant="outline" className="text-xs">
                {Math.floor(dayTotalMinutes / 60)}h {dayTotalMinutes % 60}m
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredTimeSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No scheduled jobs</p>
              {selectedStageId && (
                <p className="text-xs mt-1">for selected stage</p>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => onDragEnd(event, allDayStages, day.date)}
            >
              <SortableContext 
                items={allDayStages.map(stage => stage.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={`space-y-3 ${isReordering ? 'opacity-60' : ''}`}>
                  {filteredTimeSlots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {slot.time_slot}
                      </div>
                      
                      <div className="space-y-2">
                        {(slot.scheduled_stages || []).map((stage) => (
                          <SortableScheduleStageCard
                            key={stage.id}
                            stage={stage}
                            onJobClick={onJobClick}
                            isAdminUser={isAdminUser}
                            disabled={isReordering || stage.is_split_job}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SortableContext>
              
              {isReordering && (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RotateCcw className="h-3 w-3 animate-spin" />
                    Recalculating schedule...
                  </div>
                </div>
              )}
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
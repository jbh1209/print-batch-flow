import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { ScheduleDayData, ScheduledStageData } from "@/hooks/useScheduleReader";

interface ScheduleDayColumnProps {
  day: ScheduleDayData;
  selectedStageId?: string | null;
  selectedStageName?: string | null;
  onJobClick?: (stage: ScheduledStageData) => void;
}

export const ScheduleDayColumn: React.FC<ScheduleDayColumnProps> = ({
  day,
  selectedStageId,
  selectedStageName,
  onJobClick
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
            filteredTimeSlots.map((slot, slotIndex) => (
              <div key={slotIndex} className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {slot.time_slot}
                </div>
                
                {(slot.scheduled_stages || []).map((stage, stageIndex) => (
                  <Card 
                    key={stageIndex} 
                    className="p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4"
                    style={{ borderLeftColor: stage.stage_color || '#6B7280' }}
                    onClick={() => onJobClick?.(stage)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.stage_color || '#6B7280' }}
                          />
                          <span className="font-medium text-sm">
                            {stage.job_wo_no}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {stage.estimated_duration_minutes}m
                        </Badge>
                      </div>
                      
                      <div className="text-xs font-medium text-muted-foreground">
                        {stage.stage_name}
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        {stage.scheduled_start_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(stage.scheduled_start_at), 'HH:mm')}
                            {stage.scheduled_end_at && (
                              <span> - {format(new Date(stage.scheduled_end_at), 'HH:mm')}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center pt-1">
                        <Badge 
                          variant={stage.status === 'completed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {stage.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Order: {stage.stage_order}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
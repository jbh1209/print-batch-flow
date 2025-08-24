/**
 * Read-Only Schedule Board - Displays server-calculated schedule
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, ExternalLink } from "lucide-react";
import { type ScheduleDayData, type ScheduledStageData } from "@/hooks/useScheduleReader";

interface ReadOnlyScheduleBoardProps {
  scheduleDays: ScheduleDayData[];
}

function StageCard({ stage }: { stage: ScheduledStageData }) {
  const startTime = stage.start_hhmm;
  const endTime = stage.end_hhmm;
  
  const formatTime = (date: Date) => 
    date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

  return (
    <Card className="mb-2 border-l-4" style={{ borderLeftColor: stage.stage_color }}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="font-medium text-sm">{stage.job_wo_no}</div>
            <div className="text-xs text-muted-foreground">{stage.stage_name}</div>
          </div>
          <Badge variant="secondary" className="text-xs">
            #{stage.stage_order}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {startTime} - {endTime}
          </div>
          <div>
            {stage.estimated_duration_minutes}min
          </div>
        </div>
        
        <div className="mt-2 flex items-center justify-between">
          <Badge 
            variant={stage.status === 'scheduled' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {stage.status}
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs"
            onClick={() => {
              // TODO: Open manual reschedule dialog
              console.log('Reschedule stage:', stage.id);
            }}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TimeSlotColumn({ 
  timeSlot, 
  stages, 
  date 
}: { 
  timeSlot: string; 
  stages: ScheduledStageData[]; 
  date: string;
}) {
  return (
    <div className="min-w-64 border-r bg-gray-50/50">
      <div className="sticky top-0 bg-white border-b p-3 z-10">
        <div className="font-medium text-sm">{timeSlot}</div>
        <div className="text-xs text-muted-foreground">
          {stages.length} stage{stages.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div className="p-3">
        {stages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            No stages scheduled
          </div>
        ) : (
          stages.map(stage => (
            <StageCard key={stage.id} stage={stage} />
          ))
        )}
      </div>
    </div>
  );
}

function DayColumn({ day }: { day: ScheduleDayData }) {
  const dateObj = new Date(day.date);
  const isToday = day.date === new Date().toISOString().split('T')[0];
  
  return (
    <div className="flex-shrink-0 border-r">
      {/* Day Header */}
      <div className={`sticky top-0 bg-white border-b p-4 z-20 ${isToday ? 'bg-blue-50' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-semibold ${isToday ? 'text-blue-600' : ''}`}>
              {day.day_name}
            </div>
            <div className="text-sm text-muted-foreground">
              {dateObj.toLocaleDateString('en-GB', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{day.total_stages}</div>
            <div className="text-xs text-muted-foreground">
              {Math.floor(day.total_minutes / 60)}h {day.total_minutes % 60}m
            </div>
          </div>
        </div>
      </div>
      
      {/* Time Slots */}
      <div className="flex">
        {day.time_slots.map(slot => (
          <TimeSlotColumn
            key={slot.time_slot}
            timeSlot={slot.time_slot}
            stages={slot.scheduled_stages}
            date={day.date}
          />
        ))}
      </div>
    </div>
  );
}

export function ReadOnlyScheduleBoard({ scheduleDays }: ReadOnlyScheduleBoardProps) {
  if (scheduleDays.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Scheduled Stages</h3>
          <p className="text-sm text-muted-foreground mb-4">
            There are no stages scheduled yet. Stages are automatically scheduled when jobs are approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex">
        {scheduleDays.map(day => (
          <DayColumn key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  Clock,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimeEntry {
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  notes?: string;
  jobNumber: string;
}

interface TimeTrackerProps {
  onTimeUpdate: (timeData: TimeEntry) => Promise<void>;
  jobNumber: string;
  className?: string;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({
  onTimeUpdate,
  jobNumber,
  className
}) => {
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTimeToday, setTotalTimeToday] = useState(0);

  // Update elapsed time every second when tracking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, startTime]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = () => {
    const now = new Date();
    setStartTime(now);
    setIsTracking(true);
    setElapsedTime(0);
  };

  const handleStopTimer = async () => {
    if (!startTime) return;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    const timeEntry: TimeEntry = {
      startTime,
      endTime,
      duration,
      jobNumber
    };

    try {
      await onTimeUpdate(timeEntry);
      setTotalTimeToday(prev => prev + duration);
      setIsTracking(false);
      setStartTime(null);
      setElapsedTime(0);
    } catch (error) {
      console.error('Failed to save time entry:', error);
    }
  };

  const handleResetTimer = () => {
    setIsTracking(false);
    setStartTime(null);
    setElapsedTime(0);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time Tracking
          {isTracking && (
            <Badge variant="default" className="bg-green-600 animate-pulse">
              Recording
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Session */}
        <div className="text-center space-y-2">
          <div className="text-3xl font-mono font-bold text-blue-600">
            {formatTime(elapsedTime)}
          </div>
          <p className="text-sm text-gray-600">Current Session</p>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!isTracking ? (
            <Button 
              onClick={handleStartTimer}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Timer
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleStopTimer}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                <Pause className="h-4 w-4 mr-2" />
                Stop & Save
              </Button>
              <Button 
                onClick={handleResetTimer}
                variant="outline"
                size="icon"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Daily Summary */}
        {totalTimeToday > 0 && (
          <div className="pt-3 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Today:</span>
              <span className="font-semibold">{formatTime(totalTimeToday)}</span>
            </div>
          </div>
        )}

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div 
            className={cn(
              "w-2 h-2 rounded-full",
              isTracking ? "bg-green-500 animate-pulse" : "bg-gray-300"
            )}
          />
          <span>{isTracking ? "Timer active" : "Timer stopped"}</span>
        </div>
      </CardContent>
    </Card>
  );
};

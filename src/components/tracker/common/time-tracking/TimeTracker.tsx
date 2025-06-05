
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause } from "lucide-react";

interface TimeSession {
  id: string;
  start_time: Date;
  end_time?: Date;
  duration_minutes: number;
  is_active: boolean;
}

interface TimeEntry {
  start_time: Date;
  end_time?: Date;
  duration_minutes: number;
  notes?: string;
}

interface TimeTrackerProps {
  onTimeUpdate?: (timeData: TimeEntry) => Promise<void>;
  jobNumber: string;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({
  onTimeUpdate,
  jobNumber
}) => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const start = activeSession.start_time.getTime();
      setElapsedTime(Math.floor((now - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
  };

  const getTotalTimeSpent = () => {
    const completedTime = timeEntries.reduce((total, entry) => total + entry.duration_minutes, 0);
    const activeTime = activeSession ? Math.floor(elapsedTime / 60) : 0;
    return completedTime + activeTime;
  };

  const handleStartTimer = () => {
    if (activeSession) return;

    const newSession: TimeSession = {
      id: `session_${Date.now()}`,
      start_time: new Date(),
      is_active: true,
      duration_minutes: 0
    };

    setActiveSession(newSession);
    setElapsedTime(0);
  };

  const handleStopTimer = async () => {
    if (!activeSession) return;

    const endTime = new Date();
    const durationMinutes = Math.floor(elapsedTime / 60);

    const completedEntry: TimeEntry = {
      start_time: activeSession.start_time,
      end_time: endTime,
      duration_minutes: durationMinutes,
      notes: `Work session on ${jobNumber}`
    };

    setTimeEntries(prev => [...prev, completedEntry]);
    setActiveSession(null);
    setElapsedTime(0);

    if (onTimeUpdate) {
      try {
        await onTimeUpdate(completedEntry);
      } catch (error) {
        console.error("Failed to save time entry:", error);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Time Tracking</h4>
        <Badge variant="secondary">
          Total: {formatDuration(getTotalTimeSpent())}
        </Badge>
      </div>

      {activeSession ? (
        <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Active Session</span>
            <Badge variant="default" className="bg-green-600">
              {formatTime(elapsedTime)}
            </Badge>
          </div>
          <Button 
            onClick={handleStopTimer}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <Pause className="h-4 w-4" />
            Stop
          </Button>
        </div>
      ) : (
        <Button 
          onClick={handleStartTimer}
          className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4" />
          Start Timer
        </Button>
      )}

      {timeEntries.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Previous Sessions</h5>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {timeEntries.slice(-5).map((entry, index) => (
              <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-600">
                  {entry.start_time.toLocaleDateString()} {entry.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Badge variant="outline">
                  {formatDuration(entry.duration_minutes)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

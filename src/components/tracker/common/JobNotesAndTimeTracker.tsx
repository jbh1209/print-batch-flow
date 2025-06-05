
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  Play, 
  Pause, 
  Save, 
  FileText,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobNotesAndTimeTrackerProps {
  job: AccessibleJob;
  onNotesUpdate?: (jobId: string, notes: string) => Promise<void>;
  onTimeUpdate?: (jobId: string, timeData: TimeEntry) => Promise<void>;
  className?: string;
}

interface TimeEntry {
  start_time: Date;
  end_time?: Date;
  duration_minutes: number;
  notes?: string;
}

interface TimeSession {
  id: string;
  start_time: Date;
  end_time?: Date;
  duration_minutes: number;
  is_active: boolean;
}

export const JobNotesAndTimeTracker: React.FC<JobNotesAndTimeTrackerProps> = ({
  job,
  onNotesUpdate,
  onTimeUpdate,
  className
}) => {
  const [notes, setNotes] = useState("");
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Timer effect for active sessions
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
      notes: `Work session on ${job.wo_no}`
    };

    setTimeEntries(prev => [...prev, completedEntry]);
    setActiveSession(null);
    setElapsedTime(0);

    if (onTimeUpdate) {
      try {
        await onTimeUpdate(job.job_id, completedEntry);
      } catch (error) {
        console.error("Failed to save time entry:", error);
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!onNotesUpdate || !notes.trim()) return;

    setIsSaving(true);
    try {
      await onNotesUpdate(job.job_id, notes.trim());
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notes & Time Tracking
          <Badge variant="outline" className="ml-auto">
            {job.wo_no}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time Tracker */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Time Tracking
            </h4>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Total: {formatDuration(getTotalTimeSpent())}
              </Badge>
            </div>
          </div>

          {/* Active Timer */}
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

          {/* Time Entries History */}
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

        <Separator />

        {/* Notes Section */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Work Notes
          </h4>
          
          <Textarea
            placeholder={`Add notes about your work on ${job.wo_no}...`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[120px] resize-none"
          />
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {notes.length}/1000 characters
            </span>
            <Button 
              onClick={handleSaveNotes}
              disabled={!notes.trim() || isSaving}
              size="sm"
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

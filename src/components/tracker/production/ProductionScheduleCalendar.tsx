import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, AlertTriangle } from "lucide-react";
import { useProductionCalendar } from "@/hooks/tracker/useProductionCalendar";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { useFlowBasedScheduling } from "@/hooks/tracker/useFlowBasedScheduling";

interface ProductionScheduleCalendarProps {
  selectedWeek?: Date;
}

export const ProductionScheduleCalendar: React.FC<ProductionScheduleCalendarProps> = ({
  selectedWeek = new Date()
}) => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(selectedWeek, { weekStartsOn: 1 }));
  const { jobsByDate, isLoading, startJob, completeJob } = useProductionCalendar();
  const { scheduleJob, isCalculating } = useFlowBasedScheduling();

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(currentWeek, index));
  }, [currentWeek]);

  // Get jobs grouped by date from the custom hook

  const handleScheduleJob = async (jobId: string, targetDate: Date) => {
    try {
      await scheduleJob(jobId, 'production_jobs', 100);
      // Job will be updated in the database and reflected in the UI
    } catch (error) {
      console.error('Error scheduling job:', error);
    }
  };

  const getJobsForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return jobsByDate[dateKey] || [];
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
    setCurrentWeek(newWeek);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span>Loading production schedule...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Production Schedule
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                Previous
              </Button>
              <span className="text-sm font-medium px-3">
                Week of {format(currentWeek, 'MMM d, yyyy')}
              </span>
              <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                Next
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Calendar Grid */}
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayJobs = getJobsForDate(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card key={index} className={`min-h-[300px] ${isToday ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {format(day, 'EEE')}
                  <br />
                  {format(day, 'MMM d')}
                </CardTitle>
                {dayJobs.length > 0 && (
                  <Badge variant="secondary" className="w-fit">
                    {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {dayJobs.map((job) => (
                   <div
                    key={job.job_id}
                    className={`p-2 rounded border transition-colors cursor-pointer ${
                      job.isBottleneck 
                        ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' 
                        : 'bg-card hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm">{job.wo_no}</span>
                      <Badge 
                        variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {job.current_stage_status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {job.customer}
                    </div>
                     <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{job.display_stage_name}</span>
                      {job.queuePosition && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          Q{job.queuePosition}
                        </Badge>
                      )}
                      {job.isBottleneck && (
                        <AlertTriangle className="h-3 w-3 text-amber-500 ml-1" />
                      )}
                    </div>
                    {job.workflow_progress > 0 && (
                      <div className="mt-1">
                        <div className="w-full bg-secondary rounded-full h-1">
                          <div 
                            className="bg-primary h-1 rounded-full transition-all" 
                            style={{ width: `${job.workflow_progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1 mt-2">
                      {job.current_stage_status === 'pending' && job.user_can_work && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => startJob(job.job_id, job.current_stage_id)}
                        >
                          Start
                        </Button>
                      )}
                      {job.current_stage_status === 'active' && job.user_can_work && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 text-xs"
                          onClick={() => completeJob(job.job_id, job.current_stage_id)}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Empty state for days with no jobs */}
                {dayJobs.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No jobs scheduled
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
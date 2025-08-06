import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, Play, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useProductionCalendarFixed } from '@/hooks/tracker/useProductionCalendarFixed';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';

export const ProductionCalendarFixed: React.FC = () => {
  const { jobs, jobsByDate, isLoading, error, startJob, completeJob, getJobsForDate } = useProductionCalendarFixed();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workingOnJobs, setWorkingOnJobs] = useState<Set<string>>(new Set());

  // Get current week dates
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }); // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handleStartJob = async (jobId: string, stageId: string) => {
    setWorkingOnJobs(prev => new Set(prev).add(jobId));
    try {
      await startJob(jobId, stageId);
    } finally {
      setWorkingOnJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const handleCompleteJob = async (jobId: string, stageId: string) => {
    setWorkingOnJobs(prev => new Set(prev).add(jobId));
    try {
      await completeJob(jobId, stageId);
    } finally {
      setWorkingOnJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500 text-white';
      case 'completed': return 'bg-green-500 text-white';
      case 'pending': return 'bg-yellow-500 text-black';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Production Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading schedule...
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalJobsThisWeek = weekDays.reduce((total, day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    return total + (jobsByDate[dayKey]?.length || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Production Calendar - Week of {format(weekStart, 'MMM d')}
          </CardTitle>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total Jobs This Week: {totalJobsThisWeek}</span>
            <span>Total Jobs Available: {jobs.length}</span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Debug Info */}
          <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded">
            <div>Debug: {jobs.length} jobs loaded</div>
            <div>Dates with jobs: {Object.keys(jobsByDate).join(', ')}</div>
            <div>Selected week: {format(weekStart, 'yyyy-MM-dd')} to {format(weekEnd, 'yyyy-MM-dd')}</div>
          </div>

          {/* Week Navigation */}
          <div className="flex gap-2 mb-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            >
              Previous Week
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setSelectedDate(new Date())}
            >
              This Week
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            >
              Next Week
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-4">
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayJobs = jobsByDate[dayKey] || [];
              const isToday = isSameDay(day, new Date());
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <Card 
                  key={dayKey} 
                  className={`${isToday ? 'ring-2 ring-primary' : ''} ${isWeekend ? 'bg-muted/50' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {format(day, 'd')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'EEE')}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {dayJobs.length} jobs
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {dayJobs.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-4">
                        No jobs scheduled
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayJobs.slice(0, 3).map(job => (
                          <div 
                            key={`${job.job_id}-${job.stage_name}`}
                            className="p-2 border rounded text-xs space-y-1"
                          >
                            <div className="font-medium truncate" title={job.wo_no}>
                              {job.wo_no}
                            </div>
                            <div className="text-muted-foreground truncate" title={job.customer}>
                              {job.customer}
                            </div>
                            <div className="flex items-center gap-1">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: job.stage_color }}
                              />
                              <span className="truncate" title={job.stage_name}>
                                {job.stage_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{Math.round(job.estimated_duration_minutes / 60)}h</span>
                              <Badge 
                                className={`text-xs ${getStatusColor(job.current_stage_status)}`}
                                variant="secondary"
                              >
                                {job.current_stage_status}
                              </Badge>
                            </div>
                            {job.is_expedited && (
                              <Badge variant="destructive" className="text-xs">
                                EXPEDITED
                              </Badge>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex gap-1 mt-2">
                              {job.current_stage_status === 'pending' && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleStartJob(job.job_id, job.production_stage_id)}
                                  disabled={workingOnJobs.has(job.job_id)}
                                  className="h-6 px-2 text-xs"
                                >
                                  {workingOnJobs.has(job.job_id) ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Play className="h-3 w-3 mr-1" />
                                      Start
                                    </>
                                  )}
                                </Button>
                              )}
                              {job.current_stage_status === 'active' && (
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  onClick={() => handleCompleteJob(job.job_id, job.production_stage_id)}
                                  disabled={workingOnJobs.has(job.job_id)}
                                  className="h-6 px-2 text-xs"
                                >
                                  {workingOnJobs.has(job.job_id) ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Complete
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {dayJobs.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center py-1">
                            +{dayJobs.length - 3} more jobs
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Jobs List for Selected Day */}
      <Card>
        <CardHeader>
          <CardTitle>
            Jobs for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const selectedDayKey = format(selectedDate, 'yyyy-MM-dd');
            const selectedDayJobs = jobsByDate[selectedDayKey] || [];
            
            if (selectedDayJobs.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  No jobs scheduled for this day
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {selectedDayJobs.map(job => (
                  <div 
                    key={`${job.job_id}-${job.stage_name}`}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">#{job.queue_position}</Badge>
                        <div>
                          <div className="font-medium">{job.wo_no}</div>
                          <div className="text-sm text-muted-foreground">{job.customer}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: job.stage_color }}
                          />
                          <span>{job.stage_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{Math.round(job.estimated_duration_minutes / 60)}h</span>
                        </div>
                        <Badge className={getStatusColor(job.current_stage_status)}>
                          {job.current_stage_status}
                        </Badge>
                        {job.is_expedited && (
                          <Badge variant="destructive">EXPEDITED</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {job.current_stage_status === 'pending' && (
                        <Button 
                          variant="outline"
                          onClick={() => handleStartJob(job.job_id, job.production_stage_id)}
                          disabled={workingOnJobs.has(job.job_id)}
                        >
                          {workingOnJobs.has(job.job_id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Start Job
                            </>
                          )}
                        </Button>
                      )}
                      {job.current_stage_status === 'active' && (
                        <Button 
                          onClick={() => handleCompleteJob(job.job_id, job.production_stage_id)}
                          disabled={workingOnJobs.has(job.job_id)}
                        >
                          {workingOnJobs.has(job.job_id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete Job
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};
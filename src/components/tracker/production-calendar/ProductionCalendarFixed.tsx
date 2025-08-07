import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, Play, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useProductionCalendarFixed } from '@/hooks/tracker/useProductionCalendarFixed';
import { format, addDays, isSameDay } from 'date-fns';
import { getBusinessWeekDates, getWeekStartMonday, getNextBusinessDay } from '@/utils/businessDays';

interface ProductionCalendarFixedProps {
  selectedStageId?: string | null;
  selectedStageName?: string | null;
}

export const ProductionCalendarFixed: React.FC<ProductionCalendarFixedProps> = ({
  selectedStageId,
  selectedStageName
}) => {
  const { jobs, jobsByDate, isLoading, error, startJob, completeJob, getJobsForDate } = useProductionCalendarFixed(selectedStageId);
  // Start from next business day by default
  const [selectedDate, setSelectedDate] = useState(() => getNextBusinessDay());
  const [workingOnJobs, setWorkingOnJobs] = useState<Set<string>>(new Set());

  // Get business week dates (Monday-Friday only)
  const weekDays = getBusinessWeekDates(selectedDate);
  const weekStart = weekDays[0]; // Monday
  const weekEnd = weekDays[4]; // Friday

  const handleStartJob = async (jobId: string, stageId: string) => {
    setWorkingOnJobs(prev => new Set(prev).add(`${jobId}-${stageId}`));
    try {
      await startJob(jobId, stageId);
    } finally {
      setWorkingOnJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${jobId}-${stageId}`);
        return newSet;
      });
    }
  };

  const handleCompleteJob = async (jobId: string, stageId: string) => {
    setWorkingOnJobs(prev => new Set(prev).add(`${jobId}-${stageId}`));
    try {
      await completeJob(jobId, stageId);
    } finally {
      setWorkingOnJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${jobId}-${stageId}`);
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

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading schedule...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-2">Failed to load schedule</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Weekly calendar grid
  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 min-h-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {selectedStageName ? `${selectedStageName} Schedule` : 'Production Schedule'} - Week of {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const previousWeek = addDays(weekStart, -7);
                  setSelectedDate(previousWeek);
                }}
              >
                Previous Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(getNextBusinessDay())}
              >
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextWeek = addDays(weekStart, 7);
                  setSelectedDate(nextWeek);
                }}
              >
                Next Week
              </Button>
            </div>
          </div>
          
          {/* Week Summary */}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total jobs this week: {weekDays.reduce((total, day) => total + getJobsForDate(format(day, 'yyyy-MM-dd')).length, 0)}</span>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
          <div className="h-full grid grid-cols-5 gap-0 border-t">
            {weekDays.map((day, index) => {
              const dayJobs = getJobsForDate(format(day, 'yyyy-MM-dd'));
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={format(day, 'yyyy-MM-dd')}
                  className={`border-r last:border-r-0 h-full flex flex-col cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
                    ${isToday ? 'bg-yellow-50' : ''}
                  `}
                  onClick={() => setSelectedDate(day)}
                >
                  {/* Day Header */}
                  <div className={`p-3 border-b text-center ${isSelected ? 'bg-blue-100' : 'bg-gray-50'}`}>
                    <div className="text-xs font-medium text-gray-600">
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                      {format(day, 'dd')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Jobs Preview */}
                  <div className="flex-1 p-2 space-y-1 overflow-y-auto">
                    {dayJobs.slice(0, 3).map((job) => (
                      <div
                        key={`${job.job_id}-${job.production_stage_id}`}
                        className="text-xs bg-white border rounded p-2 shadow-sm"
                      >
                        <div className="font-medium text-gray-900 truncate">
                          {job.wo_no}
                        </div>
                        <div className="text-gray-600 truncate">
                          {job.customer}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <Badge 
                            variant="outline"
                            className={getStatusColor(job.current_stage_status)}
                          >
                            {job.current_stage_status}
                          </Badge>
                          <div className="text-gray-500">
                            {job.estimated_duration_minutes ? `${Math.round(job.estimated_duration_minutes / 60)}h` : '—'}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-1 mt-2">
                          {job.current_stage_status === 'pending' && job.user_can_work && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartJob(job.job_id, job.production_stage_id);
                              }}
                              disabled={workingOnJobs.has(`${job.job_id}-${job.production_stage_id}`)}
                            >
                              {workingOnJobs.has(`${job.job_id}-${job.production_stage_id}`) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              Start
                            </Button>
                          )}
                          {job.current_stage_status === 'active' && job.user_can_work && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteJob(job.job_id, job.production_stage_id);
                              }}
                              disabled={workingOnJobs.has(`${job.job_id}-${job.production_stage_id}`)}
                            >
                              {workingOnJobs.has(`${job.job_id}-${job.production_stage_id}`) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {dayJobs.length > 3 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        +{dayJobs.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
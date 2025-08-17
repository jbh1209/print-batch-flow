import React, { useState, useMemo, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { LoadingState } from '@/components/users/LoadingState';
import { AccessRestrictedMessage } from '@/components/users/AccessRestrictedMessage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Settings, Plus, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks, isToday } from 'date-fns';
import { useAccessibleJobs } from '@/hooks/tracker/useAccessibleJobs';
import { ProductionHeader } from '@/components/tracker/production/ProductionHeader';
import { ProductionStats } from '@/components/tracker/production/ProductionStats';
import { EnhancedProductionJobCard } from '@/components/tracker/production/EnhancedProductionJobCard';
import AdminHeader from '@/components/admin/AdminHeader';
import { supabase } from '@/integrations/supabase/client';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

const WeeklyScheduleBoard: React.FC = () => {
  const { isAdmin, isLoading: authLoading } = useAdminAuth();
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  const [weekScheduledJobs, setWeekScheduledJobs] = useState<Record<string, any[]>>({});

  const { 
    jobs, 
    isLoading, 
    error,
    startJob,
    completeJob,
    refreshJobs,
    invalidateCache
  } = useAccessibleJobs({
    permissionType: 'manage'
  });

  // Calculate week boundaries
  const weekStart = useMemo(() => {
    return startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  }, [currentWeek]);

  const weekEnd = useMemo(() => {
    return endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday end
  }, [currentWeek]);

  // Enhanced filtering to handle batch processing jobs and parallel stages
  const filteredJobs = useMemo(() => {
    if (!selectedStageName) {
      return jobs;
    }

    return jobs.filter(job => {
      // Special handling for batch processing
      if (selectedStageName === 'In Batch Processing') {
        return job.status === 'In Batch Processing';
      }
      
      // Check if job should appear in this stage based on parallel stages
      if (job.parallel_stages && job.parallel_stages.length > 0) {
        return job.parallel_stages.some(stage => stage.stage_name === selectedStageName);
      }
      
      // Fallback to original logic for jobs without parallel stage data
      const currentStage = job.current_stage_name || job.display_stage_name;
      return currentStage === selectedStageName;
    });
  }, [jobs, selectedStageName]);


  // Enhanced stages to include batch processing and parallel stages
  const consolidatedStages = useMemo(() => {
    const stageMap = new Map();
    
    jobs.forEach(job => {
      // Add parallel stages from each job
      if (job.parallel_stages && job.parallel_stages.length > 0) {
        job.parallel_stages.forEach(stage => {
          stageMap.set(stage.stage_id, {
            stage_id: stage.stage_id,
            stage_name: stage.stage_name,
            stage_color: stage.stage_color || '#6B7280'
          });
        });
      } else if (job.current_stage_id && job.current_stage_name) {
        // Fallback for jobs without parallel stage data
        stageMap.set(job.current_stage_id, {
          stage_id: job.current_stage_id,
          stage_name: job.current_stage_name,
          stage_color: job.current_stage_color || '#6B7280'
        });
      }
    });
    
    // Add virtual batch processing stage if we have jobs in that status
    const batchJobs = jobs.filter(job => job.status === 'In Batch Processing');
    if (batchJobs.length > 0) {
      stageMap.set('batch-processing', {
        stage_id: 'batch-processing',
        stage_name: 'In Batch Processing',
        stage_color: '#F59E0B'
      });
    }
    
    return Array.from(stageMap.values());
  }, [jobs]);

  const getJobCountForStage = (stageName: string) => {
    return jobs.filter(job => {
      const currentStage = job.current_stage_name || job.display_stage_name;
      
      // Check if job's current stage matches
      if (currentStage === stageName) {
        return true;
      }
      
      // Check if job has parallel stages that match
      if (job.parallel_stages && job.parallel_stages.length > 0) {
        return job.parallel_stages.some(stage => stage.stage_name === stageName);
      }
      
      return false;
    }).length;
  };

  const getJobCountByStatus = (status: string) => {
    return jobs.filter(job => {
      const hasActiveStage = job.current_stage_status === 'active';
      const hasPendingStages = job.current_stage_status === 'pending';
      const allCompleted = job.workflow_progress === 100;
      
      switch (status) {
        case 'completed': return allCompleted;
        case 'in-progress': return hasActiveStage;
        case 'pending': return hasPendingStages;
        case 'overdue':
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          const today = new Date();
          return dueDate < today && !allCompleted;
        default: return false;
      }
    }).length;
  };

  const handleStageSelect = (stageId: string | null, stageName: string | null) => {
    console.log('Stage selected:', { stageId, stageName });
    setSelectedStageId(stageId);
    setSelectedStageName(stageName);
  };

  const handleStageClick = (stageId: string, stageName: string) => {
    console.log('Sidebar stage clicked:', { stageId, stageName, selectedStageId, selectedStageName });
    
    if (selectedStageId === stageId) {
      // Clicking the same stage - deselect it
      handleStageSelect(null, null);
    } else {
      // Select the new stage
      handleStageSelect(stageId, stageName);
    }
  };

  const handleAllJobsClick = () => {
    console.log('All jobs clicked');
    handleStageSelect(null, null);
  };

  const handleStatusFilter = (status: string) => {
    console.log('Status filter clicked:', status);
    // For now, just show all jobs - could extend this later
    handleStageSelect(null, null);
  };

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    try {
      if (action === 'start') {
        const success = await startJob(jobId, stageId);
        if (success) {
          console.log('Stage started successfully');
        }
      } else if (action === 'complete') {
        const success = await completeJob(jobId, stageId);
        if (success) {
          console.log('Stage completed successfully');
        }
      } else if (action === 'qr-scan') {
        console.log('QR scan action triggered');
      }
      
      await refreshJobs();
      
    } catch (error) {
      console.error('Error performing stage action:', error);
    }
  };

  const handleJobClick = (job: AccessibleJob) => {
    console.log('Job clicked:', job.wo_no);
  };

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  // Fetch all scheduled jobs for the week
  useEffect(() => {
    const fetchWeekJobs = async () => {
      if (!jobs.length) return;
      
      try {
        const { data: scheduledStages, error } = await supabase
          .from('job_stage_instances')
          .select(`
            job_id,
            production_stage_id,
            scheduled_start_at,
            scheduled_end_at,
            scheduled_minutes,
            stage_order,
            production_stages!inner(name, color)
          `)
          .not('scheduled_start_at', 'is', null)
          .gte('scheduled_start_at', weekStart.toISOString().split('T')[0])
          .lt('scheduled_start_at', addDays(weekEnd, 1).toISOString().split('T')[0])
          .eq('job_table_name', 'production_jobs');

        if (error) {
          console.error('Error fetching scheduled jobs:', error);
          return;
        }

        // Group by day and match with job data
        const groupedByDay: Record<string, any[]> = {
          Monday: [],
          Tuesday: [],
          Wednesday: [],
          Thursday: [],
          Friday: []
        };

        scheduledStages?.forEach(stage => {
          const job = jobs.find(j => j.job_id === stage.job_id);
          if (job) {
            const stageDate = new Date(stage.scheduled_start_at);
            const dayIndex = stageDate.getDay();
            // Convert Sunday=0 to Monday=0 system
            const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
            
            if (adjustedDayIndex >= 0 && adjustedDayIndex <= 4) {
              const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][adjustedDayIndex];
              groupedByDay[dayName].push({
                ...stage,
                job_data: job
              });
            }
          }
        });
        
        setWeekScheduledJobs(groupedByDay);
      } catch (error) {
        console.error('Error processing scheduled jobs:', error);
      }
    };
    
    fetchWeekJobs();
  }, [jobs, weekStart, weekEnd]);

  useEffect(() => {
    document.title = "Weekly Schedule Board | Production Planning";
  }, []);

  if (authLoading || isLoading) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <AccessRestrictedMessage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Error loading production data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        <AdminHeader
          title="Weekly Schedule Board"
          subtitle="Plan and organize production jobs across Monday to Friday shifts"
        />

        <div className="mt-6 flex h-[calc(100vh-200px)]">
          {/* Left Sidebar - Production Stages (same as Production workflow) */}
          <div className="w-64 border-r bg-white overflow-y-auto">
            <div className="w-full overflow-y-auto p-4">
              {/* Production Stages */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Production Stages
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <Button 
                    variant={!selectedStageId ? "default" : "ghost"} 
                    size="sm" 
                    className="w-full justify-start text-xs h-8"
                    onClick={handleAllJobsClick}
                  >
                    All Jobs
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {jobs.length}
                    </Badge>
                  </Button>
                  {consolidatedStages.map(stage => {
                    const jobCount = getJobCountForStage(stage.stage_name);
                    const isSelected = selectedStageId === stage.stage_id;
                    return (
                      <Button 
                        key={stage.stage_id}
                        variant={isSelected ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => handleStageClick(stage.stage_id, stage.stage_name)}
                      >
                        <div 
                          className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: stage.stage_color }}
                        />
                        <span className="truncate flex-1 text-left">
                          {stage.stage_name}
                        </span>
                        <Badge variant="secondary" className="ml-auto text-xs font-bold">
                          {jobCount}
                        </Badge>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Quick Status Filters */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Status Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
                    { id: 'in-progress', label: 'In Progress', icon: Play, color: 'text-blue-500' },
                    { id: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500' },
                    { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-500' }
                  ].map(status => (
                    <Button 
                      key={status.id}
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start text-xs h-8"
                      onClick={() => handleStatusFilter(status.id)}
                    >
                      <status.icon className={`h-3 w-3 mr-2 ${status.color}`} />
                      <span className="flex-1 text-left">{status.label}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {getJobCountByStatus(status.id)}
                      </Badge>
                    </Button>
                  ))}
                </CardContent>
              </Card>

              {/* Stage Management */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Stage Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    <Plus className="h-3 w-3 mr-2" />
                    Add Stage
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    <Settings className="h-3 w-3 mr-2" />
                    Configure Workflow
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header with Week Navigation */}
            <div className="border-b bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Weekly Schedule: {format(weekStart, 'MMMM d')} - {format(weekEnd, 'd, yyyy')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedStageName ? `Showing ${selectedStageName} jobs` : 'Showing all jobs'} scheduled for this week
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                    This Week
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToNextWeek}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Production Stats */}
              <ProductionStats 
                jobs={filteredJobs}
                jobsWithoutCategory={[]}
              />
            </div>

            {/* Weekly Grid - Monday to Friday */}
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-5 gap-4 h-full">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((dayName, dayIndex) => {
                  const dayDate = addDays(weekStart, dayIndex);
                  const isCurrentDay = isToday(dayDate);
                  
                  // Get scheduled jobs for this day from the week data
                  let dayScheduledJobs = weekScheduledJobs[dayName] || [];
                  
                  // Apply stage filtering if a specific stage is selected
                  if (selectedStageName && selectedStageName !== 'Batch Processing' && selectedStageName !== 'All Jobs') {
                    dayScheduledJobs = dayScheduledJobs.filter(job => 
                      job.production_stages?.name === selectedStageName
                    );
                  }
                  
                  return (
                    <Card key={dayName} className={`flex flex-col h-full ${isCurrentDay ? 'border-primary shadow-md' : ''}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span className={isCurrentDay ? 'text-primary' : ''}>{dayName}</span>
                          <Badge variant={isCurrentDay ? 'default' : 'outline'}>
                            {format(dayDate, 'MMM d')}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {dayScheduledJobs.length} stage{dayScheduledJobs.length !== 1 ? 's' : ''} scheduled
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto">
                        {dayScheduledJobs.length === 0 ? (
                          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                            <div className="text-center">
                              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No jobs scheduled</p>
                              <p className="text-xs mt-1">Approve jobs to see them here</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {dayScheduledJobs.map((scheduledJob, index) => (
                              <div 
                                key={`${scheduledJob.job_id}-${scheduledJob.production_stage_id}-${index}`}
                                className="p-2 border rounded-md bg-card"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">
                                    {scheduledJob.job_data?.wo_no}
                                  </span>
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: scheduledJob.production_stages.color }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {scheduledJob.production_stages.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {Math.round(scheduledJob.scheduled_minutes || 0)}min
                                </div>
                                <div className="text-xs font-medium">
                                  {scheduledJob.job_data?.customer}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyScheduleBoard;
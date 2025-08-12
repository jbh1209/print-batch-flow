import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  RefreshCw,
  Calendar,
  BarChart3
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

interface StageWorkload {
  stageId: string;
  stageName: string;
  totalPendingHours: number;
  totalActiveHours: number;
  pendingJobsCount: number;
  activeJobsCount: number;
  dailyCapacityHours: number;
  maxParallelJobs: number;
  isBottleneck: boolean;
  earliestAvailableSlot: Date;
  queueDaysToProcess: number;
}

export const ProductionWorkloadDashboard: React.FC = () => {
  const [workloads, setWorkloads] = useState<StageWorkload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchWorkloads = async () => {
    try {
      setIsLoading(true);
      // Mock workload data for now since we're using workflow-first engine
      const mockWorkloads: StageWorkload[] = [
        {
          stageId: '1',
          stageName: 'Cover',
          totalPendingHours: 20,
          totalActiveHours: 5,
          pendingJobsCount: 3,
          activeJobsCount: 1,
          dailyCapacityHours: 8,
          maxParallelJobs: 2,
          isBottleneck: false,
          earliestAvailableSlot: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          queueDaysToProcess: 2.5
        },
        {
          stageId: '2',
          stageName: 'Text',
          totalPendingHours: 40,
          totalActiveHours: 12,
          pendingJobsCount: 5,
          activeJobsCount: 2,
          dailyCapacityHours: 6,
          maxParallelJobs: 3,
          isBottleneck: true,
          earliestAvailableSlot: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          queueDaysToProcess: 7.2
        }
      ];
      setWorkloads(mockWorkloads);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching workloads:', error);
      toast({
        title: "Error loading workloads",
        description: "Failed to fetch production workload data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWorkloads = async () => {
    try {
      await fetchWorkloads();
      toast({
        title: "Workloads updated",
        description: "Production workload data has been refreshed"
      });
    } catch (error) {
      console.error('Error refreshing workloads:', error);
      toast({
        title: "Error refreshing workloads",
        description: "Failed to update production workload data",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchWorkloads();
  }, []);

  const formatDuration = (hours: number): string => {
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  const getQueueSeverity = (queueDays: number) => {
    if (queueDays <= 1) return { color: 'bg-green-500', label: 'Good', variant: 'default' as const };
    if (queueDays <= 3) return { color: 'bg-yellow-500', label: 'Moderate', variant: 'secondary' as const };
    if (queueDays <= 7) return { color: 'bg-orange-500', label: 'High', variant: 'destructive' as const };
    return { color: 'bg-red-500', label: 'Critical', variant: 'destructive' as const };
  };

  const bottleneckStages = workloads.filter(w => w.isBottleneck || w.queueDaysToProcess > 5);
  const totalPendingJobs = workloads.reduce((sum, w) => sum + w.pendingJobsCount, 0);
  const totalActiveJobs = workloads.reduce((sum, w) => sum + w.activeJobsCount, 0);
  const averageQueueDays = workloads.length > 0 
    ? workloads.reduce((sum, w) => sum + w.queueDaysToProcess, 0) / workloads.length 
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Production Workload Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner message="Loading production workload data..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Production Workload Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time view of production stage queues and capacity
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <Button onClick={refreshWorkloads} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pending Jobs</p>
                <p className="text-2xl font-bold">{totalPendingJobs}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold">{totalActiveJobs}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Queue Length</p>
                <p className="text-2xl font-bold">{averageQueueDays.toFixed(1)} days</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bottlenecks</p>
                <p className="text-2xl font-bold">{bottleneckStages.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottleneck Alert */}
      {bottleneckStages.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Production Bottlenecks Detected:</strong> {bottleneckStages.map(s => s.stageName).join(', ')} 
            {' '}have significant queue backlogs that may impact delivery times.
          </AlertDescription>
        </Alert>
      )}

      {/* Stage Workload Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {workloads.map((workload) => {
          const severity = getQueueSeverity(workload.queueDaysToProcess);
          const capacityUtilization = ((workload.totalPendingHours + workload.totalActiveHours) / 
            (workload.dailyCapacityHours * 7)) * 100; // Weekly utilization
          
          return (
            <Card key={workload.stageId} className={workload.isBottleneck ? 'border-red-200 bg-red-50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{workload.stageName}</CardTitle>
                  <Badge variant={severity.variant}>{severity.label}</Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Queue Length */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Queue Length</span>
                    <span className="font-medium">{workload.queueDaysToProcess} days</span>
                  </div>
                  <Progress 
                    value={Math.min(capacityUtilization, 100)} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground">
                    {capacityUtilization.toFixed(1)}% weekly capacity utilization
                  </div>
                </div>

                {/* Job Counts */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Pending</p>
                    <p className="font-medium">{workload.pendingJobsCount} jobs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Active</p>
                    <p className="font-medium">{workload.activeJobsCount} jobs</p>
                  </div>
                </div>

                {/* Hours Breakdown */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Pending Work</p>
                    <p className="font-medium">{formatDuration(workload.totalPendingHours)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">In Progress</p>
                    <p className="font-medium">{formatDuration(workload.totalActiveHours)}</p>
                  </div>
                </div>

                {/* Capacity Info */}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <p>Daily Capacity: {workload.dailyCapacityHours}h</p>
                  <p>Next Available: {workload.earliestAvailableSlot.toLocaleDateString()}</p>
                  {workload.isBottleneck && (
                    <Badge variant="destructive" className="mt-1 text-xs">
                      Production Bottleneck
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {workloads.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No production stages found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
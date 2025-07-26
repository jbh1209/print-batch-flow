import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Users, 
  Calendar,
  BarChart3,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { ProductionPlanningCalendar } from './ProductionPlanningCalendar';
import { ProductionMetrics } from './ProductionMetrics';
import { ResourceUtilization } from './ResourceUtilization';
import { BottleneckAnalysis } from './BottleneckAnalysis';
import { SmartQueueDashboard } from './SmartQueueDashboard';
import { DynamicReschedulingDashboard } from './DynamicReschedulingDashboard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductionStats {
  total_jobs: number;
  jobs_in_progress: number;
  jobs_completed_today: number;
  average_cycle_time: number;
  capacity_utilization: number;
  bottleneck_stage: string;
  expedited_jobs: number;
  overdue_jobs: number;
}

export const ProductionAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<ProductionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProductionStats();
  }, []);

  const loadProductionStats = async () => {
    try {
      setIsLoading(true);
      
      // Get basic job statistics
      const today = new Date().toISOString().split('T')[0];
      
      const [
        totalJobsResult,
        inProgressResult,
        completedTodayResult,
        expeditedResult,
        overdueResult
      ] = await Promise.all([
        // Total active jobs
        supabase
          .from('production_jobs')
          .select('id')
          .neq('status', 'completed'),
        
        // Jobs in progress
        supabase
          .from('job_stage_instances')
          .select('job_id')
          .eq('status', 'active')
          .eq('job_table_name', 'production_jobs'),
        
        // Jobs completed today
        supabase
          .from('job_stage_instances')
          .select('job_id')
          .eq('status', 'completed')
          .eq('job_table_name', 'production_jobs')
          .gte('completed_at', today),
        
        // Expedited jobs
        supabase
          .from('production_jobs')
          .select('id')
          .eq('is_expedited', true),
        
        // Overdue jobs (jobs past their due date)
        supabase
          .from('production_jobs')
          .select('id')
          .lt('due_date', today)
          .neq('status', 'completed')
      ]);

      // Calculate capacity utilization from daily workload
      const { data: workloadData } = await supabase
        .from('daily_workload')
        .select('capacity_utilization')
        .eq('date', today)
        .single();

      // Find bottleneck stage (stage with most active jobs)
      const { data: stageData } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          production_stages:production_stage_id (name)
        `)
        .eq('status', 'active')
        .eq('job_table_name', 'production_jobs');

      let bottleneckStage = 'None';
      if (stageData && stageData.length > 0) {
        const stageCounts = stageData.reduce((acc: Record<string, number>, stage: any) => {
          const stageName = stage.production_stages?.name || 'Unknown';
          acc[stageName] = (acc[stageName] || 0) + 1;
          return acc;
        }, {});
        
        bottleneckStage = Object.entries(stageCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'None';
      }

      setStats({
        total_jobs: totalJobsResult.data?.length || 0,
        jobs_in_progress: new Set(inProgressResult.data?.map(j => j.job_id)).size || 0,
        jobs_completed_today: new Set(completedTodayResult.data?.map(j => j.job_id)).size || 0,
        average_cycle_time: 24, // TODO: Calculate actual cycle time
        capacity_utilization: workloadData?.capacity_utilization || 0,
        bottleneck_stage: bottleneckStage,
        expedited_jobs: expeditedResult.data?.length || 0,
        overdue_jobs: overdueResult.data?.length || 0
      });
    } catch (error) {
      console.error('Error loading production stats:', error);
      toast.error('Failed to load production statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 100) return 'text-red-600';
    if (utilization >= 80) return 'text-yellow-600';
    if (utilization >= 60) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold">{stats?.total_jobs || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats?.jobs_in_progress || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold">{stats?.jobs_completed_today || 0}</p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Capacity</p>
                <p className={`text-2xl font-bold ${getUtilizationColor(stats?.capacity_utilization || 0)}`}>
                  {Math.round(stats?.capacity_utilization || 0)}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      {(stats?.expedited_jobs || 0) > 0 || (stats?.overdue_jobs || 0) > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(stats?.expedited_jobs || 0) > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Expedited Jobs</p>
                    <p className="text-lg font-bold text-yellow-900">{stats.expedited_jobs} jobs require immediate attention</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(stats?.overdue_jobs || 0) > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Overdue Jobs</p>
                    <p className="text-lg font-bold text-red-900">{stats.overdue_jobs} jobs past due date</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Bottleneck Alert */}
      {stats?.bottleneck_stage && stats.bottleneck_stage !== 'None' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-800">Production Bottleneck</p>
                <p className="text-lg font-bold text-orange-900">
                  {stats.bottleneck_stage} stage has the most active jobs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="calendar">Planning Calendar</TabsTrigger>
          <TabsTrigger value="queues">Smart Queues</TabsTrigger>
          <TabsTrigger value="rescheduling">Dynamic Rescheduling</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="resources">Resource Utilization</TabsTrigger>
          <TabsTrigger value="analysis">Bottleneck Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <ProductionPlanningCalendar />
        </TabsContent>

        <TabsContent value="queues" className="space-y-4">
          <SmartQueueDashboard />
        </TabsContent>

        <TabsContent value="rescheduling" className="space-y-4">
          <DynamicReschedulingDashboard />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <ProductionMetrics />
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <ResourceUtilization />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <BottleneckAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};
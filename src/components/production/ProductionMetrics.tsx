import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, TrendingDown, Clock, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StageMetrics {
  stage_name: string;
  total_jobs: number;
  completed_jobs: number;
  avg_duration_hours: number;
  estimated_vs_actual: number;
  completion_rate: number;
}

interface ProductionMetricsData {
  daily_throughput: number;
  weekly_throughput: number;
  avg_cycle_time: number;
  on_time_delivery: number;
  stage_metrics: StageMetrics[];
}

export const ProductionMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<ProductionMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProductionMetrics();
  }, []);

  const loadProductionMetrics = async () => {
    try {
      setIsLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Daily throughput (jobs completed today)
      const { data: dailyCompletions } = await supabase
        .from('job_stage_instances')
        .select('job_id')
        .eq('status', 'completed')
        .eq('job_table_name', 'production_jobs')
        .gte('completed_at', today);

      // Weekly throughput
      const { data: weeklyCompletions } = await supabase
        .from('job_stage_instances')
        .select('job_id')
        .eq('status', 'completed')
        .eq('job_table_name', 'production_jobs')
        .gte('completed_at', weekAgo);

      // Stage performance metrics
      const { data: stageData } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          status,
          estimated_duration_minutes,
          actual_duration_minutes,
          production_stages:production_stage_id (name)
        `)
        .eq('job_table_name', 'production_jobs')
        .gte('created_at', weekAgo);

      // Process stage metrics
      const stageMetrics: StageMetrics[] = [];
      if (stageData) {
        const stageGroups = stageData.reduce((acc: Record<string, any[]>, stage) => {
          const stageName = stage.production_stages?.name || 'Unknown';
          if (!acc[stageName]) acc[stageName] = [];
          acc[stageName].push(stage);
          return acc;
        }, {});

        Object.entries(stageGroups).forEach(([stageName, stages]) => {
          const completed = stages.filter(s => s.status === 'completed');
          const total = stages.length;
          
          const avgDuration = completed.length > 0
            ? completed.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0) / completed.length / 60
            : 0;

          const estimatedVsActual = completed.length > 0
            ? completed.reduce((sum, s) => {
                if (s.estimated_duration_minutes && s.actual_duration_minutes) {
                  return sum + (s.actual_duration_minutes / s.estimated_duration_minutes);
                }
                return sum + 1;
              }, 0) / completed.length * 100
            : 100;

          stageMetrics.push({
            stage_name: stageName,
            total_jobs: total,
            completed_jobs: completed.length,
            avg_duration_hours: avgDuration,
            estimated_vs_actual: estimatedVsActual,
            completion_rate: total > 0 ? (completed.length / total) * 100 : 0
          });
        });
      }

      setMetrics({
        daily_throughput: new Set(dailyCompletions?.map(c => c.job_id)).size || 0,
        weekly_throughput: new Set(weeklyCompletions?.map(c => c.job_id)).size || 0,
        avg_cycle_time: 24, // TODO: Calculate actual cycle time
        on_time_delivery: 85, // TODO: Calculate actual on-time delivery
        stage_metrics: stageMetrics.sort((a, b) => b.total_jobs - a.total_jobs)
      });
    } catch (error) {
      console.error('Error loading production metrics:', error);
      toast.error('Failed to load production metrics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading metrics...</span>
        </CardContent>
      </Card>
    );
  }

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600';
    if (percentage >= 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance <= 110 && variance >= 90) return <Target className="h-4 w-4 text-green-600" />;
    if (variance > 110) return <TrendingUp className="h-4 w-4 text-red-600" />;
    return <TrendingDown className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Daily Throughput</p>
              <p className="text-3xl font-bold text-primary">{metrics?.daily_throughput || 0}</p>
              <p className="text-sm text-muted-foreground">jobs completed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Weekly Throughput</p>
              <p className="text-3xl font-bold text-primary">{metrics?.weekly_throughput || 0}</p>
              <p className="text-sm text-muted-foreground">jobs this week</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Avg Cycle Time</p>
              <p className="text-3xl font-bold text-primary">{metrics?.avg_cycle_time || 0}h</p>
              <p className="text-sm text-muted-foreground">per job</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">On-Time Delivery</p>
              <p className={`text-3xl font-bold ${getPerformanceColor(metrics?.on_time_delivery || 0)}`}>
                {metrics?.on_time_delivery || 0}%
              </p>
              <p className="text-sm text-muted-foreground">target: 95%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Stage Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics?.stage_metrics.map((stage) => (
              <div key={stage.stage_name} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{stage.stage_name}</h4>
                  <div className="flex items-center gap-2">
                    {getVarianceIcon(stage.estimated_vs_actual)}
                    <Badge variant={stage.completion_rate >= 80 ? 'default' : 'secondary'}>
                      {Math.round(stage.completion_rate)}% complete
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Jobs</p>
                    <p className="font-semibold">{stage.total_jobs}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p className="font-semibold">{stage.completed_jobs}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Duration</p>
                    <p className="font-semibold">{Math.round(stage.avg_duration_hours * 10) / 10}h</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estimate Accuracy</p>
                    <p className={`font-semibold ${getPerformanceColor(stage.estimated_vs_actual)}`}>
                      {Math.round(stage.estimated_vs_actual)}%
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <Progress value={stage.completion_rate} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
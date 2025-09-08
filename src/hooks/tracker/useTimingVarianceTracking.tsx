import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TimingVariance {
  job_id: string;
  stage_id: string;
  stage_name: string;
  wo_no: string;
  scheduled_start: string;
  actual_start: string;
  scheduled_end: string;
  actual_end: string;
  scheduled_duration_minutes: number;
  actual_duration_minutes: number;
  variance_minutes: number;
  variance_percentage: number;
  operator_name?: string;
  category_name?: string;
}

export interface SchedulingAccuracyMetrics {
  total_completed_stages: number;
  on_time_stages: number;
  early_stages: number;
  late_stages: number;
  avg_variance_minutes: number;
  accuracy_percentage: number;
  improvement_trend: 'improving' | 'declining' | 'stable';
}

export const useTimingVarianceTracking = (dateRange?: { from: Date; to: Date }) => {
  const [variances, setVariances] = useState<TimingVariance[]>([]);
  const [accuracyMetrics, setAccuracyMetrics] = useState<SchedulingAccuracyMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimingVariances = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching timing variances...');

      let query = supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          scheduled_start_at,
          scheduled_end_at,
          started_at,
          completed_at,
          scheduled_minutes,
          actual_duration_minutes,
          started_by,
          production_stage:production_stages(name),
          job:production_jobs(wo_no, category:categories(name))
        `)
        .eq('status', 'completed')
        .not('scheduled_start_at', 'is', null)
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null);

      if (dateRange?.from) {
        query = query.gte('completed_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('completed_at', dateRange.to.toISOString());
      }

      const { data: stageData, error: fetchError } = await query.order('completed_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Calculate variances
      const varianceData: TimingVariance[] = (stageData || []).map(stage => {
        const scheduledStart = new Date(stage.scheduled_start_at!);
        const actualStart = new Date(stage.started_at!);
        const scheduledEnd = new Date(stage.scheduled_end_at!);
        const actualEnd = new Date(stage.completed_at!);

        const scheduledDuration = stage.scheduled_minutes || 0;
        const actualDuration = stage.actual_duration_minutes || 0;
        const varianceMinutes = actualDuration - scheduledDuration;
        const variancePercentage = scheduledDuration > 0 ? (varianceMinutes / scheduledDuration) * 100 : 0;

        return {
          job_id: stage.job_id,
          stage_id: stage.id,
          stage_name: stage.production_stage?.name || 'Unknown Stage',
          wo_no: (stage.job as any)?.wo_no || 'Unknown',
          scheduled_start: stage.scheduled_start_at!,
          actual_start: stage.started_at!,
          scheduled_end: stage.scheduled_end_at!,
          actual_end: stage.completed_at!,
          scheduled_duration_minutes: scheduledDuration,
          actual_duration_minutes: actualDuration,
          variance_minutes: varianceMinutes,
          variance_percentage: variancePercentage,
          category_name: (stage.job as any)?.category?.name
        };
      });

      setVariances(varianceData);

      // Calculate accuracy metrics
      const totalStages = varianceData.length;
      const onTimeStages = varianceData.filter(v => Math.abs(v.variance_percentage) <= 10).length;
      const earlyStages = varianceData.filter(v => v.variance_minutes < -5).length;
      const lateStages = varianceData.filter(v => v.variance_minutes > 5).length;
      const avgVariance = totalStages > 0 
        ? varianceData.reduce((sum, v) => sum + Math.abs(v.variance_minutes), 0) / totalStages 
        : 0;
      const accuracy = totalStages > 0 ? (onTimeStages / totalStages) * 100 : 0;

      setAccuracyMetrics({
        total_completed_stages: totalStages,
        on_time_stages: onTimeStages,
        early_stages: earlyStages,
        late_stages: lateStages,
        avg_variance_minutes: avgVariance,
        accuracy_percentage: accuracy,
        improvement_trend: accuracy > 80 ? 'improving' : accuracy > 60 ? 'stable' : 'declining'
      });

      console.log('✅ Timing variances fetched successfully');
    } catch (err) {
      console.error('❌ Error fetching timing variances:', err);
      setError(err instanceof Error ? err.message : 'Failed to load timing data');
      toast.error('Failed to load timing variance data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchTimingVariances();
  }, [fetchTimingVariances]);

  return {
    variances,
    accuracyMetrics,
    isLoading,
    error,
    refreshData: fetchTimingVariances
  };
};
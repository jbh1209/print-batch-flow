
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StageAnalytics {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  avg_duration_hours: number;
  min_duration_hours: number;
  max_duration_hours: number;
  completion_rate: number;
  bottleneck_score: number;
}

interface WorkflowMetrics {
  total_active_jobs: number;
  total_completed_jobs: number;
  avg_workflow_duration: number;
  workflow_completion_rate: number;
  bottleneck_stages: StageAnalytics[];
  efficiency_score: number;
}

interface CategoryPerformance {
  category_id: string;
  category_name: string;
  category_color: string;
  total_jobs: number;
  avg_completion_time: number;
  completion_rate: number;
  stages: StageAnalytics[];
}

export const useWorkflowAnalytics = (dateRange?: { from: Date; to: Date }) => {
  const [analytics, setAnalytics] = useState<StageAnalytics[]>([]);
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowMetrics | null>(null);
  const [categoryPerformance, setCategoryPerformance] = useState<CategoryPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStageAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching workflow analytics...');

      // Build date filter
      let query = supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          status,
          started_at,
          completed_at,
          production_stage:production_stages(
            id,
            name,
            color
          )
        `);

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      const { data: stageData, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Process analytics data
      const stageMap = new Map<string, {
        stage_id: string;
        stage_name: string;
        stage_color: string;
        jobs: Array<{
          status: string;
          duration_hours?: number;
        }>;
      }>();

      (stageData || []).forEach(stage => {
        const stageId = stage.production_stage_id;
        const stageName = stage.production_stage?.name || 'Unknown';
        const stageColor = stage.production_stage?.color || '#6B7280';
        
        if (!stageMap.has(stageId)) {
          stageMap.set(stageId, {
            stage_id: stageId,
            stage_name: stageName,
            stage_color: stageColor,
            jobs: []
          });
        }

        const duration_hours = stage.started_at && stage.completed_at
          ? (new Date(stage.completed_at).getTime() - new Date(stage.started_at).getTime()) / (1000 * 60 * 60)
          : undefined;

        stageMap.get(stageId)!.jobs.push({
          status: stage.status,
          duration_hours
        });
      });

      // Calculate analytics for each stage
      const analyticsData: StageAnalytics[] = Array.from(stageMap.values()).map(stage => {
        const totalJobs = stage.jobs.length;
        const activeJobs = stage.jobs.filter(j => j.status === 'active').length;
        const completedJobs = stage.jobs.filter(j => j.status === 'completed').length;
        const durations = stage.jobs
          .filter(j => j.duration_hours !== undefined)
          .map(j => j.duration_hours!);

        const avgDuration = durations.length > 0 
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
          : 0;
        const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
        const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
        const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
        
        // Bottleneck score: combination of active jobs and avg duration
        const bottleneckScore = (activeJobs * 0.6) + (avgDuration > 24 ? (avgDuration / 24) * 0.4 : 0);

        return {
          stage_id: stage.stage_id,
          stage_name: stage.stage_name,
          stage_color: stage.stage_color,
          total_jobs: totalJobs,
          active_jobs: activeJobs,
          completed_jobs: completedJobs,
          avg_duration_hours: avgDuration,
          min_duration_hours: minDuration,
          max_duration_hours: maxDuration,
          completion_rate: completionRate,
          bottleneck_score: bottleneckScore
        };
      });

      setAnalytics(analyticsData);

      // Calculate overall workflow metrics
      const totalActiveJobs = analyticsData.reduce((sum, stage) => sum + stage.active_jobs, 0);
      const totalCompletedJobs = analyticsData.reduce((sum, stage) => sum + stage.completed_jobs, 0);
      const avgWorkflowDuration = analyticsData.length > 0
        ? analyticsData.reduce((sum, stage) => sum + stage.avg_duration_hours, 0) / analyticsData.length
        : 0;
      const workflowCompletionRate = (totalActiveJobs + totalCompletedJobs) > 0
        ? (totalCompletedJobs / (totalActiveJobs + totalCompletedJobs)) * 100
        : 0;
      
      // Identify bottleneck stages (top 3 by bottleneck score)
      const bottleneckStages = [...analyticsData]
        .sort((a, b) => b.bottleneck_score - a.bottleneck_score)
        .slice(0, 3);

      // Calculate efficiency score (0-100)
      const efficiencyScore = Math.max(0, Math.min(100, 
        100 - (avgWorkflowDuration > 72 ? ((avgWorkflowDuration - 72) / 72) * 50 : 0) - 
        (bottleneckStages[0]?.bottleneck_score || 0) * 10
      ));

      setWorkflowMetrics({
        total_active_jobs: totalActiveJobs,
        total_completed_jobs: totalCompletedJobs,
        avg_workflow_duration: avgWorkflowDuration,
        workflow_completion_rate: workflowCompletionRate,
        bottleneck_stages: bottleneckStages,
        efficiency_score: efficiencyScore
      });

      console.log('✅ Workflow analytics fetched successfully');
    } catch (err) {
      console.error('❌ Error fetching workflow analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      toast.error('Failed to load workflow analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategoryPerformance = async () => {
    try {
      console.log('🔄 Fetching category performance...');

      const { data: categoryData, error: fetchError } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          color,
          category_production_stages(
            production_stage_id,
            stage_order,
            production_stage:production_stages(
              id,
              name,
              color
            )
          )
        `);

      if (fetchError) throw fetchError;

      const performanceData: CategoryPerformance[] = await Promise.all(
        (categoryData || []).map(async (category) => {
          // Get job stage instances for this category
          const { data: stageInstances } = await supabase
            .from('job_stage_instances')
            .select('*')
            .eq('category_id', category.id);

          const totalJobs = new Set(stageInstances?.map(si => si.job_id) || []).size;
          
          // Calculate category-level metrics
          const completedStages = stageInstances?.filter(si => si.status === 'completed') || [];
          const avgCompletionTime = completedStages.length > 0
            ? completedStages
                .filter(si => si.started_at && si.completed_at)
                .reduce((sum, si) => {
                  const duration = (new Date(si.completed_at!).getTime() - new Date(si.started_at!).getTime()) / (1000 * 60 * 60);
                  return sum + duration;
                }, 0) / completedStages.length
            : 0;

          // Calculate stage analytics for this category
          const stageAnalytics: StageAnalytics[] = category.category_production_stages.map(cps => {
            const stageInstances = (stageInstances || []).filter(si => si.production_stage_id === cps.production_stage_id);
            const completedCount = stageInstances.filter(si => si.status === 'completed').length;
            const activeCount = stageInstances.filter(si => si.status === 'active').length;
            
            return {
              stage_id: cps.production_stage_id,
              stage_name: cps.production_stage?.name || 'Unknown',
              stage_color: cps.production_stage?.color || '#6B7280',
              total_jobs: stageInstances.length,
              active_jobs: activeCount,
              completed_jobs: completedCount,
              avg_duration_hours: avgCompletionTime,
              min_duration_hours: 0,
              max_duration_hours: 0,
              completion_rate: stageInstances.length > 0 ? (completedCount / stageInstances.length) * 100 : 0,
              bottleneck_score: activeCount * 0.6
            };
          });

          return {
            category_id: category.id,
            category_name: category.name,
            category_color: category.color,
            total_jobs: totalJobs,
            avg_completion_time: avgCompletionTime,
            completion_rate: totalJobs > 0 ? (completedStages.length / totalJobs) * 100 : 0,
            stages: stageAnalytics
          };
        })
      );

      setCategoryPerformance(performanceData);
      console.log('✅ Category performance fetched successfully');
    } catch (err) {
      console.error('❌ Error fetching category performance:', err);
    }
  };

  useEffect(() => {
    fetchStageAnalytics();
    fetchCategoryPerformance();
  }, [dateRange]);

  // Computed metrics
  const topPerformingStages = useMemo(() => {
    return [...analytics]
      .sort((a, b) => b.completion_rate - a.completion_rate)
      .slice(0, 5);
  }, [analytics]);

  const slowestStages = useMemo(() => {
    return [...analytics]
      .sort((a, b) => b.avg_duration_hours - a.avg_duration_hours)
      .slice(0, 5);
  }, [analytics]);

  return {
    analytics,
    workflowMetrics,
    categoryPerformance,
    topPerformingStages,
    slowestStages,
    isLoading,
    error,
    refreshAnalytics: fetchStageAnalytics
  };
};

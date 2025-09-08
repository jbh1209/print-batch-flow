import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface QueueUpdate {
  type: 'stage_started' | 'stage_completed' | 'job_expedited' | 'schedule_updated';
  timestamp: string;
  job_id: string;
  wo_no: string;
  stage_name: string;
  operator_name?: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QueueMetrics {
  active_jobs: number;
  stages_in_progress: number;
  completed_today: number;
  upcoming_deadlines: number;
  average_queue_time: number;
}

export const useRealTimeQueueUpdates = () => {
  const [updates, setUpdates] = useState<QueueUpdate[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchCurrentMetrics = useCallback(async () => {
    try {
      // Get active jobs count
      const { count: activeJobs } = await supabase
        .from('job_stage_instances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get stages in progress
      const { count: stagesInProgress } = await supabase
        .from('job_stage_instances')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'started']);

      // Get completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: completedToday } = await supabase
        .from('job_stage_instances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', today.toISOString());

      // Get upcoming deadlines (next 24 hours)
      const next24Hours = new Date();
      next24Hours.setHours(next24Hours.getHours() + 24);
      const { count: upcomingDeadlines } = await supabase
        .from('job_stage_instances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lte('scheduled_start_at', next24Hours.toISOString())
        .not('scheduled_start_at', 'is', null);

      setMetrics({
        active_jobs: activeJobs || 0,
        stages_in_progress: stagesInProgress || 0,
        completed_today: completedToday || 0,
        upcoming_deadlines: upcomingDeadlines || 0,
        average_queue_time: 0 // Would need more complex calculation
      });
    } catch (error) {
      console.error('Error fetching queue metrics:', error);
    }
  }, []);

  const addUpdate = useCallback((update: QueueUpdate) => {
    setUpdates(prev => [update, ...prev.slice(0, 49)]); // Keep only last 50 updates
  }, []);

  useEffect(() => {
    fetchCurrentMetrics();

    // Set up real-time subscription for job stage changes
    const channel = supabase
      .channel('queue-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_stage_instances',
          filter: 'status=in.(active,completed)'
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          if (newRecord.status === 'active' && oldRecord.status === 'pending') {
            addUpdate({
              type: 'stage_started',
              timestamp: new Date().toISOString(),
              job_id: newRecord.job_id,
              wo_no: 'Unknown', // Would need to fetch job data
              stage_name: 'Unknown Stage', // Would need to fetch stage data
              message: 'Stage started',
              priority: 'medium'
            });
          } else if (newRecord.status === 'completed' && oldRecord.status === 'active') {
            addUpdate({
              type: 'stage_completed',
              timestamp: new Date().toISOString(),
              job_id: newRecord.job_id,
              wo_no: 'Unknown',
              stage_name: 'Unknown Stage',
              message: 'Stage completed',
              priority: 'low'
            });
          }
          
          // Refresh metrics when changes occur
          fetchCurrentMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'production_jobs',
          filter: 'is_expedited=eq.true'
        },
        (payload) => {
          const newRecord = payload.new as any;
          addUpdate({
            type: 'job_expedited',
            timestamp: new Date().toISOString(),
            job_id: newRecord.id,
            wo_no: newRecord.wo_no || 'Unknown',
            stage_name: 'All Stages',
            message: `Job ${newRecord.wo_no} marked as expedited`,
            priority: 'high'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('✅ Real-time queue updates connected');
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          console.error('❌ Real-time queue updates connection failed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [fetchCurrentMetrics, addUpdate]);

  return {
    updates,
    metrics,
    isConnected,
    refreshMetrics: fetchCurrentMetrics
  };
};
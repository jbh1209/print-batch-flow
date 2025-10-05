import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubTask {
  id: string;
  stage_instance_id: string;
  stage_specification_id: string;
  specification_name: string;
  sub_task_order: number;
  quantity: number | null;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'on_hold';
  started_at: string | null;
  completed_at: string | null;
  started_by: string | null;
  completed_by: string | null;
  estimated_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  notes: string | null;
}

export const useStageSubTasks = (stageInstanceId: string | null) => {
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSubTasks = async () => {
    if (!stageInstanceId) {
      setSubTasks([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_stage_sub_tasks', {
        p_stage_instance_id: stageInstanceId
      });

      if (error) throw error;
      setSubTasks((data || []) as SubTask[]);
    } catch (error) {
      console.error('Error fetching sub-tasks:', error);
      toast.error('Failed to load sub-tasks');
      setSubTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubTasks();
  }, [stageInstanceId]);

  const startSubTask = async (subTaskId: string) => {
    try {
      const { error } = await supabase
        .from('stage_sub_tasks')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', subTaskId);

      if (error) throw error;

      await fetchSubTasks();
      toast.success('Sub-task started');
      return true;
    } catch (error) {
      console.error('Error starting sub-task:', error);
      toast.error('Failed to start sub-task');
      return false;
    }
  };

  const completeSubTask = async (subTaskId: string) => {
    try {
      const { error } = await supabase
        .from('stage_sub_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', subTaskId);

      if (error) throw error;

      await fetchSubTasks();
      toast.success('Sub-task completed');
      return true;
    } catch (error) {
      console.error('Error completing sub-task:', error);
      toast.error('Failed to complete sub-task');
      return false;
    }
  };

  const holdSubTask = async (subTaskId: string, holdReason?: string) => {
    try {
      const { error } = await supabase
        .from('stage_sub_tasks')
        .update({
          status: 'on_hold',
          notes: holdReason
        })
        .eq('id', subTaskId);

      if (error) throw error;

      await fetchSubTasks();
      toast.success('Sub-task put on hold');
      return true;
    } catch (error) {
      console.error('Error holding sub-task:', error);
      toast.error('Failed to hold sub-task');
      return false;
    }
  };

  const hasSubTasks = subTasks.length > 0;
  const allSubTasksCompleted = subTasks.length > 0 && subTasks.every(st => st.status === 'completed');
  const activeSubTasks = subTasks.filter(st => st.status === 'active');

  return {
    subTasks,
    isLoading,
    hasSubTasks,
    allSubTasksCompleted,
    activeSubTasks,
    startSubTask,
    completeSubTask,
    holdSubTask,
    refreshSubTasks: fetchSubTasks
  };
};

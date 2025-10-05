import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SubTask {
  id: string;
  stage_specification_id: string;
  specification_name: string;
  sub_task_order: number;
  status: string;
  estimated_duration_minutes: number | null;
  quantity: number | null;
}

interface StageSubTaskButtonsProps {
  stageInstanceId: string;
  stageStatus: string;
  isOnHold: boolean;
  onSubTaskComplete?: () => void;
}

const StageSubTaskButtons: React.FC<StageSubTaskButtonsProps> = ({
  stageInstanceId,
  stageStatus,
  isOnHold,
  onSubTaskComplete
}) => {
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubTasks();
  }, [stageInstanceId]);

  const fetchSubTasks = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('stage_sub_tasks' as any)
        .select(`
          id,
          stage_specification_id,
          sub_task_order,
          status,
          estimated_duration_minutes,
          quantity,
          stage_specification:stage_specifications!stage_sub_tasks_stage_specification_id_fkey(name)
        `)
        .eq('stage_instance_id', stageInstanceId)
        .order('sub_task_order');

      if (error) {
        console.error('Failed to fetch sub-tasks:', error);
        return;
      }

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        stage_specification_id: item.stage_specification_id,
        specification_name: item.stage_specification?.name || 'Unknown',
        sub_task_order: item.sub_task_order,
        status: item.status,
        estimated_duration_minutes: item.estimated_duration_minutes,
        quantity: item.quantity
      }));

      setSubTasks(formattedData);
    } catch (error) {
      console.error('Error fetching sub-tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubTaskAction = async (subTaskId: string, currentStatus: string) => {
    if (!isOnHold) {
      toast.error('Stage must be on hold to manage individual sub-tasks');
      return;
    }

    setProcessingTaskId(subTaskId);
    try {
      const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = (await supabase.auth.getUser()).data.user?.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      const { error } = await supabase
        .from('stage_sub_tasks' as any)
        .update(updateData)
        .eq('id', subTaskId);

      if (error) {
        toast.error('Failed to update sub-task');
        return;
      }

      toast.success(newStatus === 'completed' ? 'Sub-task completed' : 'Sub-task reset to pending');
      await fetchSubTasks();
      onSubTaskComplete?.();
    } catch (error) {
      console.error('Error updating sub-task:', error);
      toast.error('Failed to update sub-task');
    } finally {
      setProcessingTaskId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subTasks.length === 0) {
    return null;
  }

  const completedCount = subTasks.filter(t => t.status === 'completed').length;
  const allCompleted = completedCount === subTasks.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Multiple Operations ({completedCount}/{subTasks.length} completed)
        </span>
        {isOnHold && (
          <span className="text-xs text-muted-foreground">
            Touch to toggle
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {subTasks.map((subTask) => {
          const isCompleted = subTask.status === 'completed';
          const isProcessing = processingTaskId === subTask.id;

          return (
            <Button
              key={subTask.id}
              onClick={() => handleSubTaskAction(subTask.id, subTask.status)}
              disabled={!isOnHold || isProcessing}
              variant={isCompleted ? "default" : "outline"}
              size="lg"
              className={`h-16 w-full text-left justify-start relative ${
                isCompleted 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-background hover:bg-accent'
              } ${!isOnHold ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="flex-shrink-0">
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-current" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {subTask.specification_name}
                  </div>
                  {subTask.estimated_duration_minutes && (
                    <div className="text-xs opacity-80">
                      Est: {subTask.estimated_duration_minutes} mins
                      {subTask.quantity && ` • Qty: ${subTask.quantity}`}
                    </div>
                  )}
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      {!isOnHold && (
        <div className="text-xs text-muted-foreground text-center py-2 bg-muted/50 rounded-md">
          {allCompleted 
            ? '✓ All operations complete - Resume or Complete stage'
            : 'Hold stage to manage individual operations'}
        </div>
      )}
    </div>
  );
};

export default StageSubTaskButtons;

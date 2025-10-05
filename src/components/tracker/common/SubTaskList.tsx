import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Clock, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SubTask {
  id: string;
  stage_specification_id: string;
  specification_name: string;
  sub_task_order: number;
  quantity: number;
  status: string;
  estimated_duration_minutes: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface SubTaskListProps {
  stageInstanceId: string;
  mode?: 'read-only' | 'interactive' | 'compact' | 'expanded';
  showActions?: boolean;
  stageStatus?: string;
  onSubTaskComplete?: () => void;
  className?: string;
}

export const SubTaskList: React.FC<SubTaskListProps> = ({
  stageInstanceId,
  mode = 'read-only',
  showActions = false,
  stageStatus,
  onSubTaskComplete,
  className
}) => {
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(mode === 'expanded');
  const [error, setError] = useState<string | null>(null);

  const fetchSubTasks = async () => {
    console.log('🔍 SubTaskList: Fetching sub-tasks for stage instance:', stageInstanceId, 'mode:', mode);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_stage_sub_tasks', {
        p_stage_instance_id: stageInstanceId
      });

      if (error) {
        console.error('❌ SubTaskList: RPC error:', error);
        throw error;
      }
      
      console.log('✅ SubTaskList: Received sub-tasks:', data?.length || 0, 'tasks', data);
      setSubTasks(data || []);
    } catch (error) {
      console.error('❌ SubTaskList: Error fetching sub-tasks:', error);
      setError('Failed to load operations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('🎬 SubTaskList: Component mounted with stageInstanceId:', stageInstanceId);
    if (stageInstanceId) {
      fetchSubTasks();
    } else {
      console.warn('⚠️ SubTaskList: No stageInstanceId provided');
      setIsLoading(false);
    }
  }, [stageInstanceId]);

  const handleSubTaskAction = async (subTaskId: string) => {
    const subTask = subTasks.find(st => st.id === subTaskId);
    if (!subTask) return;

    setProcessingTaskId(subTaskId);
    
    try {
      const isCompleting = subTask.status === 'pending';
      const newStatus = isCompleting ? 'completed' : 'pending';
      
      const { error } = await supabase
        .from('stage_sub_tasks')
        .update({
          status: newStatus,
          completed_at: isCompleting ? new Date().toISOString() : null,
          completed_by: isCompleting ? (await supabase.auth.getUser()).data.user?.id : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', subTaskId);

      if (error) throw error;

      toast.success(isCompleting ? 'Operation marked complete' : 'Operation marked pending');
      await fetchSubTasks();
      onSubTaskComplete?.();
    } catch (error) {
      console.error('Error updating sub-task:', error);
      toast.error('Failed to update operation');
    } finally {
      setProcessingTaskId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-spin" />
        <span>Loading operations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span>{error}</span>
        <Button variant="ghost" size="sm" onClick={fetchSubTasks}>
          Retry
        </Button>
      </div>
    );
  }

  if (subTasks.length === 0) {
    console.log('ℹ️ SubTaskList: No sub-tasks found for stage instance:', stageInstanceId);
    if (mode === 'compact') return null;
    return (
      <div className="text-xs text-muted-foreground italic">
        No operations configured
      </div>
    );
  }

  const completedCount = subTasks.filter(st => st.status === 'completed').length;
  const totalCount = subTasks.length;
  const isOnHold = stageStatus === 'on_hold';

  // Compact mode - show badge that expands inline
  if (mode === 'compact' && !isExpanded) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-xs cursor-pointer hover:bg-secondary/80", className)}
        onClick={(e) => {
          e.stopPropagation();
          console.log('🔽 SubTaskList: Expanding compact view');
          setIsExpanded(true);
        }}
      >
        <Wrench className="h-3 w-3 mr-1" />
        {totalCount} ops
        {completedCount > 0 && ` (${completedCount}/${totalCount})`}
      </Badge>
    );
  }

  // Expandable header for non-expanded modes
  const renderHeader = () => {
    if (mode === 'expanded') return null;
    
    return (
      <div
        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Operations ({completedCount}/{totalCount} completed)
        </span>
        {!isOnHold && showActions && (
          <span className="text-xs text-muted-foreground ml-2">
            (Stage must be on hold to manage)
          </span>
        )}
      </div>
    );
  };

  // Expanded content
  const renderContent = () => {
    if (!isExpanded && mode !== 'expanded') return null;

    return (
      <div className="space-y-2 mt-2">
        {subTasks.map((subTask, idx) => {
          const isCompleted = subTask.status === 'completed';
          const isProcessing = processingTaskId === subTask.id;
          
          return (
            <div
              key={subTask.id}
              className={cn(
                "flex items-center gap-3 p-3 bg-background rounded-md border transition-colors",
                isCompleted && "bg-muted/30",
                mode === 'interactive' && isOnHold && "hover:bg-muted/50"
              )}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    isCompleted && "text-muted-foreground line-through"
                  )}>
                    {idx + 1}. {subTask.specification_name}
                  </span>
                  <Badge variant={isCompleted ? "default" : "secondary"} className="text-xs">
                    {subTask.status}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Qty: {subTask.quantity.toLocaleString()}</span>
                  {subTask.estimated_duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {subTask.estimated_duration_minutes} mins
                    </span>
                  )}
                </div>
              </div>

              {mode === 'interactive' && showActions && isOnHold && (
                <Button
                  variant={isCompleted ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleSubTaskAction(subTask.id)}
                  disabled={isProcessing}
                  className="flex-shrink-0"
                >
                  {isProcessing ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : isCompleted ? (
                    "Undo"
                  ) : (
                    "Mark Complete"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      {renderHeader()}
      {renderContent()}
      {!isOnHold && showActions && isExpanded && (
        <p className="text-xs text-muted-foreground italic mt-2">
          Stage must be on hold to manage individual operations
        </p>
      )}
    </div>
  );
};

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, Pause } from "lucide-react";
import { SubTask } from "@/hooks/tracker/useStageSubTasks";

interface MultiSpecificationStagePanelProps {
  subTasks: SubTask[];
  onStartSubTask: (subTaskId: string) => Promise<boolean>;
  onCompleteSubTask: (subTaskId: string) => Promise<boolean>;
  onHoldSubTask: (subTaskId: string) => Promise<boolean>;
  isStageActive: boolean;
}

export const MultiSpecificationStagePanel = ({
  subTasks,
  onStartSubTask,
  onCompleteSubTask,
  onHoldSubTask,
  isStageActive
}: MultiSpecificationStagePanelProps) => {
  const getStatusIcon = (status: SubTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-green-600" />;
      case 'active':
        return <Clock className="h-6 w-6 text-blue-600 animate-pulse" />;
      case 'on_hold':
        return <Pause className="h-6 w-6 text-yellow-600" />;
      default:
        return <Circle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: SubTask['status']) => {
    const variants = {
      pending: 'secondary',
      active: 'default',
      completed: 'default',
      skipped: 'secondary',
      on_hold: 'secondary'
    } as const;

    const colors = {
      pending: 'text-muted-foreground',
      active: 'text-blue-600',
      completed: 'text-green-600',
      skipped: 'text-gray-500',
      on_hold: 'text-yellow-600'
    };

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const handleSubTaskAction = async (subTask: SubTask) => {
    if (!isStageActive) return;

    if (subTask.status === 'pending') {
      await onStartSubTask(subTask.id);
    } else if (subTask.status === 'active') {
      await onCompleteSubTask(subTask.id);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Multiple Operations Required</h3>
        <Badge variant="outline">{subTasks.length} operations</Badge>
      </div>

      <div className="grid gap-3">
        {subTasks.map((subTask, index) => (
          <Card key={subTask.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {getStatusIcon(subTask.status)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-base font-semibold truncate">
                    {index + 1}. {subTask.specification_name}
                  </h4>
                  {getStatusBadge(subTask.status)}
                </div>

                {subTask.quantity && (
                  <p className="text-sm text-muted-foreground">
                    Quantity: {subTask.quantity}
                  </p>
                )}

                {subTask.estimated_duration_minutes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Est. {subTask.estimated_duration_minutes} mins
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 space-y-2">
                {isStageActive && subTask.status === 'pending' && (
                  <Button
                    size="lg"
                    className="h-16 w-32 text-base font-semibold"
                    onClick={() => handleSubTaskAction(subTask)}
                  >
                    Start
                  </Button>
                )}

                {isStageActive && subTask.status === 'active' && (
                  <>
                    <Button
                      size="lg"
                      className="h-16 w-32 text-base font-semibold bg-green-600 hover:bg-green-700"
                      onClick={() => handleSubTaskAction(subTask)}
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-32"
                      onClick={() => onHoldSubTask(subTask.id)}
                    >
                      Hold
                    </Button>
                  </>
                )}

                {subTask.status === 'completed' && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    ✓ Done
                  </Badge>
                )}

                {subTask.status === 'on_hold' && isStageActive && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 w-32 text-base"
                    onClick={() => onStartSubTask(subTask.id)}
                  >
                    Resume
                  </Button>
                )}
              </div>
            </div>

            {subTask.notes && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground">{subTask.notes}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

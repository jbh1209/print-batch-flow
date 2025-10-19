import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Package, Clock } from "lucide-react";
import { MachineAllocationJob } from "@/hooks/tracker/useMachineAllocation";

interface AllocationJobCardProps {
  job: MachineAllocationJob;
  isDragging?: boolean;
}

export function AllocationJobCard({ job, isDragging = false }: AllocationJobCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getSpecificationBadge = () => {
    if (!job.stage_specifications?.name) return null;
    
    const specName = job.stage_specifications.name.toLowerCase();
    const isCylinder = specName.includes("cylinder");
    const isPlatten = specName.includes("platten") || specName.includes("hand");
    
    return (
      <Badge 
        variant="outline" 
        className={
          isCylinder 
            ? "bg-blue-500/10 text-blue-700 border-blue-500/20" 
            : isPlatten 
            ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
            : "bg-gray-500/10 text-gray-700 border-gray-500/20"
        }
      >
        {job.stage_specifications.name}
      </Badge>
    );
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-3 cursor-move hover:shadow-md transition-shadow bg-card"
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm">
              Job #{job.job_id.substring(0, 8)}
            </div>
            <Badge variant="secondary" className="text-xs">
              {job.status}
            </Badge>
          </div>

          {getSpecificationBadge()}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {job.quantity && (
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                <span>{job.quantity.toLocaleString()} sheets</span>
              </div>
            )}
            {job.estimated_duration_minutes && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{Math.round(job.estimated_duration_minutes / 60)}h</span>
              </div>
            )}
          </div>

          {job.scheduled_start_at && (
            <div className="text-xs text-muted-foreground">
              Scheduled: {new Date(job.scheduled_start_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

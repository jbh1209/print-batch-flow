import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Wrench } from "lucide-react";
import { AllocationJobCard } from "./AllocationJobCard";
import { DieCuttingMachine, MachineAllocationJob } from "@/hooks/tracker/useMachineAllocation";

interface MachineColumnProps {
  machine: DieCuttingMachine;
  jobs: MachineAllocationJob[];
  capacity: {
    current: number;
    max: number;
    isAtCapacity: boolean;
  };
}

export function MachineColumn({ machine, jobs, capacity }: MachineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: machine.id,
  });

  const getStatusIcon = () => {
    switch (machine.status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "maintenance":
        return <Wrench className="h-4 w-4 text-yellow-500" />;
      case "offline":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      active: "bg-green-500/10 text-green-700 border-green-500/20",
      maintenance: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
      offline: "bg-red-500/10 text-red-700 border-red-500/20",
    };

    return (
      <Badge variant="outline" className={statusConfig[machine.status]}>
        {getStatusIcon()}
        <span className="ml-1">{machine.status}</span>
      </Badge>
    );
  };

  const getMachineTypeBadge = () => {
    const isCylinder = machine.machine_type === "cylinder";
    return (
      <Badge
        variant="secondary"
        className={
          isCylinder
            ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
            : "bg-purple-500/10 text-purple-700 border-purple-500/20"
        }
      >
        {machine.machine_type}
      </Badge>
    );
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-lg">{machine.name}</h3>
          {getStatusBadge()}
        </div>
        
        <div className="flex items-center gap-2">
          {getMachineTypeBadge()}
          <Badge 
            variant="outline"
            className={
              capacity.isAtCapacity 
                ? "bg-red-500/10 text-red-700 border-red-500/20"
                : "bg-green-500/10 text-green-700 border-green-500/20"
            }
          >
            {capacity.current} / {capacity.max} jobs
          </Badge>
        </div>

        {machine.location && (
          <p className="text-xs text-muted-foreground">{machine.location}</p>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-4 min-h-[400px] space-y-3 transition-colors ${
          isOver ? "bg-primary/5 border-2 border-primary/20" : ""
        }`}
      >
        <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Drop jobs here
            </div>
          ) : (
            jobs.map((job) => (
              <AllocationJobCard key={job.id} job={job} />
            ))
          )}
        </SortableContext>
      </div>
    </Card>
  );
}

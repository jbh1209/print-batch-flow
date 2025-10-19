import { useState, useEffect } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings } from "lucide-react";
import { useMachineAllocation, MachineAllocationJob } from "@/hooks/tracker/useMachineAllocation";
import { MachineColumn } from "./MachineColumn";
import { AllocationJobCard } from "./AllocationJobCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function DieCuttingAllocationPage() {
  const [activeJob, setActiveJob] = useState<MachineAllocationJob | null>(null);
  const [dieCuttingStageId, setDieCuttingStageId] = useState<string>("");

  // Find the die cutting stage ID
  const { data: stages } = useQuery({
    queryKey: ["production-stages-die-cutting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stages")
        .select("id, name")
        .ilike("name", "%die%cut%")
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (stages?.id) {
      setDieCuttingStageId(stages.id);
    }
  }, [stages]);

  const {
    machines,
    unallocatedJobs,
    isLoading,
    allocateJob,
    getJobsByMachine,
    getMachineCapacity,
    refetch,
  } = useMachineAllocation(dieCuttingStageId);

  // Real-time subscription
  useEffect(() => {
    if (!dieCuttingStageId) return;

    const channel = supabase
      .channel("machine-allocation-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_stage_instances",
          filter: `production_stage_id=eq.${dieCuttingStageId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dieCuttingStageId, refetch]);

  const handleDragStart = (event: DragStartEvent) => {
    const job = [...unallocatedJobs, ...machines.flatMap(m => getJobsByMachine(m.id))]
      .find(j => j.id === event.active.id);
    if (job) {
      setActiveJob(job);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveJob(null);
      return;
    }

    const jobId = active.id as string;
    const targetId = over.id as string;

    // Check if dropping on unallocated zone
    if (targetId === "unallocated") {
      allocateJob({ jobStageId: jobId, machineId: null });
    } 
    // Check if dropping on a machine
    else if (machines.some(m => m.id === targetId)) {
      allocateJob({ jobStageId: jobId, machineId: targetId });
    }

    setActiveJob(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dieCuttingStageId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Die Cutting stage not found</p>
          <p className="text-sm text-muted-foreground">
            Please create a production stage with "Die Cut" in the name
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col gap-6 p-6 bg-background">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Die Cutting Machine Allocation</h1>
            <p className="text-muted-foreground mt-1">
              Drag and drop jobs to allocate them to specific machines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Unallocated Queue */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              📦 Unallocated Queue
              <Badge variant="secondary">{unallocatedJobs.length} jobs</Badge>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 min-h-[120px]">
            {unallocatedJobs.length === 0 ? (
              <div className="col-span-full flex items-center justify-center text-muted-foreground text-sm py-8">
                All jobs are allocated
              </div>
            ) : (
              unallocatedJobs.map((job) => (
                <AllocationJobCard key={job.id} job={job} />
              ))
            )}
          </div>
        </Card>

        {/* Machine Columns */}
        <div>
          <h2 className="text-lg font-semibold mb-4">🏭 Die Cutting Machines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines
              .filter(m => m.status === "active")
              .map((machine) => (
                <MachineColumn
                  key={machine.id}
                  machine={machine}
                  jobs={getJobsByMachine(machine.id)}
                  capacity={getMachineCapacity(machine.id)}
                />
              ))}
          </div>

          {machines.some(m => m.status !== "active") && (
            <>
              <h3 className="text-md font-semibold mt-6 mb-4 text-muted-foreground">
                Inactive Machines
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {machines
                  .filter(m => m.status !== "active")
                  .map((machine) => (
                    <MachineColumn
                      key={machine.id}
                      machine={machine}
                      jobs={getJobsByMachine(machine.id)}
                      capacity={getMachineCapacity(machine.id)}
                    />
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeJob && <AllocationJobCard job={activeJob} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}

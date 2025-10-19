import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { useMachineAllocation, type MachineAllocationJob } from "@/hooks/tracker/useMachineAllocation";
import { MachineColumn } from "../machine-allocation/MachineColumn";
import { AllocationJobCard } from "../machine-allocation/AllocationJobCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings, PackageOpen } from "lucide-react";
import { toast } from "sonner";

export const DieCuttingKanbanView = () => {
  const [activeJob, setActiveJob] = useState<MachineAllocationJob | null>(null);
  const [dieCuttingStageId, setDieCuttingStageId] = useState<string | null>(null);

  // Fetch Die Cutting stage ID
  const { data: stageData } = useQuery({
    queryKey: ["die-cutting-stage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stages")
        .select("id, name")
        .ilike("name", "%die cutting%")
        .single();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (stageData?.id) {
      setDieCuttingStageId(stageData.id);
    }
  }, [stageData]);

  // Use machine allocation hook
  const {
    machines,
    jobs,
    unallocatedJobs,
    isLoading,
    allocateJob,
    getJobsByMachine,
    getMachineCapacity,
    refetch,
  } = useMachineAllocation(dieCuttingStageId || "");

  // Real-time subscription for job updates
  useEffect(() => {
    if (!dieCuttingStageId) return;

    const channel = supabase
      .channel("die-cutting-job-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
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
    const job = jobs.find((j) => j.id === event.active.id);
    setActiveJob(job || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    if (!over) return;

    const jobId = active.id as string;
    const targetMachineId = over.id === "unallocated" ? null : (over.id as string);

    allocateJob({ jobStageId: jobId, machineId: targetMachineId });
  };

  const handleRefresh = async () => {
    await refetch();
    toast.success("Die cutting queue refreshed");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading die cutting allocation...</p>
        </div>
      </div>
    );
  }

  if (!dieCuttingStageId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <PackageOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">Die Cutting stage not found</p>
          <p className="text-sm text-muted-foreground">Please contact your administrator</p>
        </div>
      </div>
    );
  }

  // Separate active and inactive machines
  const activeMachines = machines.filter((m) => m.status === "active");
  const inactiveMachines = machines.filter((m) => m.status !== "active");

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Die Cutting Machine Allocation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Drag jobs from the queue to allocate them to machines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <PackageOpen className="h-3 w-3 mr-1" />
              {unallocatedJobs.length} Unallocated
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {activeMachines.length} Active Machines
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {jobs.length} Total Jobs
            </Badge>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-4 p-4 min-w-max">
            {/* Unallocated Queue Column */}
            <div className="w-80 flex-shrink-0">
              <Card className="h-full flex flex-col bg-muted/30">
                <div className="p-4 border-b bg-card">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Unallocated Queue</h3>
                    <Badge variant="secondary">{unallocatedJobs.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jobs waiting for allocation
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {unallocatedJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <PackageOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">All jobs allocated</p>
                    </div>
                  ) : (
                    unallocatedJobs.map((job) => (
                      <AllocationJobCard key={job.id} job={job} />
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Active Machine Columns */}
            {activeMachines.map((machine) => {
              const machineJobs = getJobsByMachine(machine.id);
              const capacity = getMachineCapacity(machine.id);

              return (
                <MachineColumn
                  key={machine.id}
                  machine={machine}
                  jobs={machineJobs}
                  capacity={capacity}
                />
              );
            })}

            {/* Inactive Machine Columns */}
            {inactiveMachines.map((machine) => {
              const machineJobs = getJobsByMachine(machine.id);
              const capacity = getMachineCapacity(machine.id);

              return (
                <MachineColumn
                  key={machine.id}
                  machine={machine}
                  jobs={machineJobs}
                  capacity={capacity}
                />
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeJob ? <AllocationJobCard job={activeJob} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

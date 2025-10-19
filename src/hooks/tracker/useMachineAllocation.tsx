import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DieCuttingMachine {
  id: string;
  name: string;
  machine_type: "cylinder" | "platten";
  location: string | null;
  status: "active" | "maintenance" | "offline";
  max_concurrent_jobs: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MachineAllocationJob {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  status: string;
  allocated_machine_id: string | null;
  stage_order: number;
  quantity: number | null;
  estimated_duration_minutes: number | null;
  scheduled_start_at: string | null;
  stage_specification_id: string | null;
  created_at: string;
  production_stages: {
    id: string;
    name: string;
  };
  stage_specifications?: {
    id: string;
    name: string;
  } | null;
}

export function useMachineAllocation(dieCuttingStageId: string) {
  const queryClient = useQueryClient();

  // Fetch die cutting machines
  const { data: machines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ["die-cutting-machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("die_cutting_machines")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as DieCuttingMachine[];
    },
  });

  // Fetch jobs for die cutting stage
  const { data: jobs = [], isLoading: jobsLoading, refetch } = useQuery({
    queryKey: ["die-cutting-jobs", dieCuttingStageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_stage_instances")
        .select(`
          id,
          job_id,
          job_table_name,
          production_stage_id,
          status,
          allocated_machine_id,
          stage_order,
          quantity,
          estimated_duration_minutes,
          scheduled_start_at,
          stage_specification_id,
          created_at,
          production_stages (
            id,
            name
          ),
          stage_specifications (
            id,
            name
          )
        `)
        .eq("production_stage_id", dieCuttingStageId)
        .in("status", ["pending", "active"])
        .order("scheduled_start_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as MachineAllocationJob[];
    },
  });

  // Allocate job to machine
  const allocateJobMutation = useMutation({
    mutationFn: async ({ 
      jobStageId, 
      machineId 
    }: { 
      jobStageId: string; 
      machineId: string | null;
    }) => {
      const { error } = await supabase
        .from("job_stage_instances")
        .update({ 
          allocated_machine_id: machineId,
          updated_at: new Date().toISOString()
        })
        .eq("id", jobStageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["die-cutting-jobs"] });
      toast.success("Job allocated successfully");
    },
    onError: (error) => {
      console.error("Allocation error:", error);
      toast.error("Failed to allocate job");
    },
  });

  // Get unallocated jobs
  const unallocatedJobs = jobs.filter(job => !job.allocated_machine_id);

  // Get jobs by machine
  const getJobsByMachine = (machineId: string) => {
    return jobs.filter(job => job.allocated_machine_id === machineId);
  };

  // Get machine capacity info
  const getMachineCapacity = (machineId: string) => {
    const machine = machines.find(m => m.id === machineId);
    const allocatedJobs = getJobsByMachine(machineId);
    return {
      current: allocatedJobs.length,
      max: machine?.max_concurrent_jobs || 1,
      isAtCapacity: allocatedJobs.length >= (machine?.max_concurrent_jobs || 1),
    };
  };

  return {
    machines,
    jobs,
    unallocatedJobs,
    isLoading: machinesLoading || jobsLoading,
    allocateJob: allocateJobMutation.mutate,
    getJobsByMachine,
    getMachineCapacity,
    refetch,
  };
}

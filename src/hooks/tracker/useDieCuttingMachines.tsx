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

export function useDieCuttingMachines() {
  const queryClient = useQueryClient();

  const { data: machines = [], isLoading } = useQuery({
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

  const updateMachineMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<DieCuttingMachine>;
    }) => {
      const { error } = await supabase
        .from("die_cutting_machines")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["die-cutting-machines"] });
      toast.success("Machine updated successfully");
    },
    onError: () => {
      toast.error("Failed to update machine");
    },
  });

  const createMachineMutation = useMutation({
    mutationFn: async (machine: Omit<DieCuttingMachine, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("die_cutting_machines")
        .insert(machine);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["die-cutting-machines"] });
      toast.success("Machine created successfully");
    },
    onError: () => {
      toast.error("Failed to create machine");
    },
  });

  return {
    machines,
    isLoading,
    updateMachine: updateMachineMutation.mutate,
    createMachine: createMachineMutation.mutate,
  };
}

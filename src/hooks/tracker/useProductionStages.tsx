
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  order_index: number;
  is_active: boolean;
  is_multi_part: boolean;
  part_definitions?: any;
}

export const useProductionStages = () => {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('production_stages')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;

      setStages(data || []);
    } catch (err) {
      console.error('Error fetching production stages:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load production stages";
      setError(errorMessage);
      toast.error("Failed to load production stages");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  return {
    stages,
    isLoading,
    error,
    refreshStages: fetchStages
  };
};

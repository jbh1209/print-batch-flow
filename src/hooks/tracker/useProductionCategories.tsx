
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionCategory {
  id: string;
  name: string;
  description?: string;
  color: string; // Made required to match Category interface
  sla_target_days: number;
  created_at: string;
  updated_at: string;
}

export const useProductionCategories = () => {
  const [categories, setCategories] = useState<ProductionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;

      // Ensure all categories have a color property
      const categoriesWithColor = (data || []).map(category => ({
        ...category,
        color: category.color || '#3B82F6' // Default blue color if none provided
      }));

      setCategories(categoriesWithColor);
    } catch (err) {
      console.error('Error fetching categories:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load categories";
      setError(errorMessage);
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    isLoading,
    error,
    refreshCategories: fetchCategories
  };
};

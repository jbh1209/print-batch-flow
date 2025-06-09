
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
      
      console.log('🔄 Fetching categories from database...');
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;

      console.log('📦 Raw categories data from database:', data);

      // Ensure all categories have proper string IDs and required properties
      const categoriesWithProperIds = (data || []).map((category, index) => {
        const categoryWithStringId = {
          ...category,
          id: String(category.id), // Explicitly convert UUID to string
          color: category.color || '#3B82F6', // Default blue color if none provided
          created_at: String(category.created_at),
          updated_at: String(category.updated_at)
        };
        
        console.log(`✅ Category ${index + 1} processed:`, {
          name: categoryWithStringId.name,
          id: categoryWithStringId.id,
          idType: typeof categoryWithStringId.id,
          idLength: categoryWithStringId.id?.length
        });
        
        return categoryWithStringId;
      });

      console.log('🎯 Final processed categories:', categoriesWithProperIds);
      setCategories(categoriesWithProperIds);
    } catch (err) {
      console.error('❌ Error fetching categories:', err);
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


import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isValidUUID, validateUUIDWithLogging } from "@/utils/uuidValidation";

interface ProductionCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
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

      // Comprehensive category validation and sanitization
      const validatedCategories = (data || [])
        .map((category, index) => {
          // Validate the category ID
          const validatedId = validateUUIDWithLogging(category.id, `category[${index}]`);
          
          if (!validatedId) {
            console.error(`❌ Skipping category with invalid ID:`, category);
            return null;
          }
          
          // Ensure all required fields are present and valid
          const validatedCategory: ProductionCategory = {
            id: validatedId,
            name: category.name || `Category ${index + 1}`,
            description: category.description || undefined,
            color: category.color || '#3B82F6',
            sla_target_days: typeof category.sla_target_days === 'number' 
              ? category.sla_target_days 
              : 3,
            created_at: category.created_at || new Date().toISOString(),
            updated_at: category.updated_at || new Date().toISOString()
          };
          
          console.log(`✅ Category ${index + 1} validated:`, {
            name: validatedCategory.name,
            id: validatedCategory.id,
            idType: typeof validatedCategory.id,
            idLength: validatedCategory.id.length
          });
          
          return validatedCategory;
        })
        .filter((category): category is ProductionCategory => category !== null);

      console.log('🎯 Final validated categories:', validatedCategories);
      setCategories(validatedCategories);
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

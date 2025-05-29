
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  description?: string;
  sla_target_days: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching categories with new security policies...');

      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (fetchError) {
        console.error('❌ Categories fetch error:', fetchError);
        throw new Error(`Failed to fetch categories: ${fetchError.message}`);
      }

      console.log('✅ Categories fetched successfully:', data?.length || 0);
      setCategories(data || []);
    } catch (err) {
      console.error('❌ Error fetching categories:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load categories";
      setError(errorMessage);
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  const createCategory = async (categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('🔄 Creating category with new security policies...');
      
      const { error } = await supabase
        .from('categories')
        .insert(categoryData);

      if (error) {
        console.error('❌ Category creation error:', error);
        throw new Error(`Failed to create category: ${error.message}`);
      }

      console.log('✅ Category created successfully');
      toast.success("Category created successfully");
      await fetchCategories();
      return true;
    } catch (err) {
      console.error('❌ Error creating category:', err);
      toast.error("Failed to create category");
      return false;
    }
  };

  const updateCategory = async (id: string, categoryData: Partial<Category>) => {
    try {
      console.log('🔄 Updating category with new security policies...');
      
      const { error } = await supabase
        .from('categories')
        .update({ ...categoryData, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('❌ Category update error:', error);
        throw new Error(`Failed to update category: ${error.message}`);
      }

      console.log('✅ Category updated successfully');
      toast.success("Category updated successfully");
      await fetchCategories();
      return true;
    } catch (err) {
      console.error('❌ Error updating category:', err);
      toast.error("Failed to update category");
      return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      console.log('🔄 Deleting category with new security policies...');
      
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Category deletion error:', error);
        throw new Error(`Failed to delete category: ${error.message}`);
      }

      console.log('✅ Category deleted successfully');
      toast.success("Category deleted successfully");
      await fetchCategories();
      return true;
    } catch (err) {
      console.error('❌ Error deleting category:', err);
      toast.error("Failed to delete category");
      return false;
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    isLoading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
};

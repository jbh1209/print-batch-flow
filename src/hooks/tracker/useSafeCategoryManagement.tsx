
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CategoryUsageStats {
  production_jobs_count: number;
  job_stage_instances_count: number;
  category_production_stages_count: number;
  can_delete: boolean;
  blocking_reason: string;
}

interface ReassignResult {
  jobs_reassigned: number;
  stages_updated: number;
  success: boolean;
  error_message: string;
}

interface SafeDeleteResult {
  success: boolean;
  message: string;
  deleted_stages: number;
}

export const useSafeCategoryManagement = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const checkCategoryUsage = async (categoryId: string): Promise<CategoryUsageStats | null> => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.rpc('get_category_usage_stats', {
        p_category_id: categoryId
      });

      if (error) {
        console.error('Error checking category usage:', error);
        toast.error('Failed to check category usage');
        return null;
      }

      return data?.[0] || null;
    } catch (err) {
      console.error('Error checking category usage:', err);
      toast.error('Failed to check category usage');
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const reassignJobsToCategory = async (
    fromCategoryId: string, 
    toCategoryId: string
  ): Promise<ReassignResult | null> => {
    setIsReassigning(true);
    try {
      const { data, error } = await supabase.rpc('reassign_jobs_to_category', {
        p_from_category_id: fromCategoryId,
        p_to_category_id: toCategoryId
      });

      if (error) {
        console.error('Error reassigning jobs:', error);
        toast.error('Failed to reassign jobs');
        return null;
      }

      const result = data?.[0];
      if (result?.success) {
        toast.success(`Successfully reassigned ${result.jobs_reassigned} jobs and updated ${result.stages_updated} workflow stages`);
      } else {
        toast.error(result?.error_message || 'Failed to reassign jobs');
      }

      return result || null;
    } catch (err) {
      console.error('Error reassigning jobs:', err);
      toast.error('Failed to reassign jobs');
      return null;
    } finally {
      setIsReassigning(false);
    }
  };

  const safeDeleteCategory = async (categoryId: string): Promise<SafeDeleteResult | null> => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('safe_delete_category', {
        p_category_id: categoryId
      });

      if (error) {
        console.error('Error deleting category:', error);
        toast.error('Failed to delete category');
        return null;
      }

      const result = data?.[0];
      if (result?.success) {
        toast.success(result.message);
      } else {
        toast.error(result?.message || 'Failed to delete category');
      }

      return result || null;
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error('Failed to delete category');
      return null;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    checkCategoryUsage,
    reassignJobsToCategory,
    safeDeleteCategory,
    isChecking,
    isReassigning,
    isDeleting
  };
};

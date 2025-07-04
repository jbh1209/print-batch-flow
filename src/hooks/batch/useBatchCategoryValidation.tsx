import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchTypeMapping {
  [key: string]: string[];
}

// Define which product categories can be batched together
const BATCH_TYPE_MAPPINGS: BatchTypeMapping = {
  'business_cards': ['Business Cards', 'business-cards'],
  'flyers': ['Flyers', 'flyer'],
  'postcards': ['Postcards', 'postcard'],
  'posters': ['Posters', 'poster'],
  'sleeves': ['Sleeves', 'sleeve'],
  'covers': ['Covers', 'cover'],
  'boxes': ['Boxes', 'box'],
  'stickers': ['Stickers', 'sticker']
};

export const useBatchCategoryValidation = () => {
  const validateBatchCompatibility = useCallback(async (
    jobIds: string[], 
    targetBatchType: string
  ): Promise<{ isValid: boolean; incompatibleJobs: any[]; message?: string }> => {
    try {
      // Get job categories
      const { data: jobs, error } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          customer,
          categories (
            name
          )
        `)
        .in('id', jobIds);

      if (error) throw error;

      const allowedCategories = BATCH_TYPE_MAPPINGS[targetBatchType] || [];
      const incompatibleJobs = jobs?.filter(job => {
        const categoryName = job.categories?.name;
        return categoryName && !allowedCategories.includes(categoryName);
      }) || [];

      if (incompatibleJobs.length > 0) {
        const incompatibleNames = incompatibleJobs.map(job => `${job.wo_no} (${job.categories?.name})`);
        return {
          isValid: false,
          incompatibleJobs,
          message: `The following jobs cannot be batched as ${targetBatchType}: ${incompatibleNames.join(', ')}`
        };
      }

      return {
        isValid: true,
        incompatibleJobs: []
      };
    } catch (error) {
      console.error('Error validating batch compatibility:', error);
      return {
        isValid: false,
        incompatibleJobs: [],
        message: 'Failed to validate batch compatibility'
      };
    }
  }, []);

  const getCompatibleBatchTypes = useCallback(async (jobIds: string[]): Promise<string[]> => {
    try {
      // Get unique categories for the selected jobs
      const { data: jobs, error } = await supabase
        .from('production_jobs')
        .select(`
          categories (
            name
          )
        `)
        .in('id', jobIds);

      if (error) throw error;

      const uniqueCategories = Array.from(new Set(
        jobs?.map(job => job.categories?.name).filter(Boolean) || []
      ));

      // Find batch types that are compatible with all categories
      const compatibleTypes = Object.entries(BATCH_TYPE_MAPPINGS).filter(([batchType, allowedCategories]) => {
        return uniqueCategories.every(category => allowedCategories.includes(category));
      }).map(([batchType]) => batchType);

      return compatibleTypes;
    } catch (error) {
      console.error('Error getting compatible batch types:', error);
      return [];
    }
  }, []);

  return {
    validateBatchCompatibility,
    getCompatibleBatchTypes,
    BATCH_TYPE_MAPPINGS
  };
};
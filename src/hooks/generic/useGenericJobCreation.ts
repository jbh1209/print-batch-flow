
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductConfig } from '@/config/productTypes';
import { toast } from 'sonner';

export const useGenericJobCreation = (config: ProductConfig) => {
  const [isLoading, setIsLoading] = useState(false);

  const createJob = async (formData: any) => {
    setIsLoading(true);
    
    try {
      // Extract the user ID from the auth session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Create the job record in the database
      const { data, error } = await supabase
        .from(config.tableName)
        .insert({
          ...formData,
          user_id: user.id,
          status: 'queued',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      toast.success(`${config.ui.jobFormTitle} job created successfully!`);
      return data;
    } catch (error) {
      console.error(`Error creating ${config.productType} job:`, error);
      toast.error(`Failed to create job: ${(error as Error).message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { createJob, isLoading };
};

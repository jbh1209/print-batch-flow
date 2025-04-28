
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/useAuth';
import { toast } from "sonner";
import { productConfigs, BaseJob, ProductConfig } from '@/config/productTypes';
import { isExistingTable } from "@/utils/database/tableUtils";

// Extended job type that includes product type information
export interface ExtendedJob extends BaseJob {
  productConfig: ProductConfig;
  urgency: "critical" | "high" | "medium" | "low";
}

export const useAllPendingJobs = () => {
  const [jobs, setJobs] = useState<ExtendedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchJobsFromTable = async (config: ProductConfig): Promise<ExtendedJob[]> => {
    if (!user) return [];
    
    try {
      // Only fetch from tables that actually exist in the database
      if (!isExistingTable(config.tableName)) {
        console.info(`Table ${config.tableName} does not exist in the database - skipping`);
        return [];
      }

      // Using any type to work around TypeScript limitations with dynamic table names
      const { data, error } = await supabase
        .from(config.tableName as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'queued')
        .order('due_date', { ascending: true });
      
      if (error) {
        // Log the error but don't throw it to prevent breaking the entire data fetch
        console.error(`Error fetching ${config.productType} jobs:`, error);
        return [];
      }
      
      // Attach the product config to each job and set default urgency
      return (data || []).map(job => {
        // First ensure we have a valid job object by typecasting to unknown first
        const jobData = job as unknown;
        
        // Then properly cast to BaseJob if it appears to be a valid job object
        if (jobData && typeof jobData === 'object' && 'id' in jobData) {
          const extendedJob: ExtendedJob = {
            ...(jobData as BaseJob),
            productConfig: config,
            urgency: "low" // Default urgency, will be calculated in the component
          };
          return extendedJob;
        }
        
        // This should never happen if our database is consistent
        console.error(`Invalid job data received for ${config.productType}:`, job);
        return null;
      }).filter(job => job !== null) as ExtendedJob[];
    } catch (err) {
      console.error(`Error fetching ${config.productType} jobs:`, err);
      return [];
    }
  };

  const fetchAllJobs = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create an array of promises to fetch jobs from each product table
      const productFetchPromises = Object.values(productConfigs).map(config => 
        fetchJobsFromTable(config)
      );
      
      // Wait for all fetch operations to complete
      const jobsByProduct = await Promise.all(productFetchPromises);
      
      // Combine all job arrays into a single array
      const allJobs = jobsByProduct.flat();
      
      setJobs(allJobs);
    } catch (err) {
      console.error('Error fetching all jobs:', err);
      setError('Failed to load jobs data');
      // Fix here: Use the correct toast API format
      toast("There was a problem loading jobs across product types.");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAllJobs();
  }, [user]);
  
  return {
    jobs,
    isLoading,
    error,
    refetch: fetchAllJobs
  };
};


import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  date?: string | null;
  so_no?: string | null;
  qt_no?: string | null;
  rep?: string | null;
  user_name?: string | null;
  category?: string | null;
  customer?: string | null;
  reference?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  highlighted?: boolean;
  qr_code_data?: string | null;
  qr_code_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const useProductionJobsData = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    console.log("fetchJobs called with user:", user?.id, "authLoading:", authLoading);
    
    // Don't fetch if auth is still loading
    if (authLoading) {
      console.log("Auth still loading, skipping fetch");
      return;
    }

    // If no user, set empty state and stop loading
    if (!user?.id) {
      console.log("No user ID, setting empty jobs");
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("Fetching production jobs for user:", user.id);

      const { data, error: fetchError } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error("Error fetching production jobs:", fetchError);
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("Production jobs fetched successfully:", data?.length || 0, "jobs");
      setJobs(data || []);

    } catch (err) {
      console.error('Error fetching production jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, authLoading]);

  // Effect to fetch jobs when auth state changes
  useEffect(() => {
    console.log("useProductionJobsData effect triggered - authLoading:", authLoading, "user:", user?.id);
    
    // Add a small delay to ensure auth state is settled
    const timeoutId = setTimeout(() => {
      if (!authLoading) {
        fetchJobs();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [fetchJobs]);

  // Add a safety timeout to prevent infinite loading
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (isLoading && !authLoading) {
        console.warn("Safety timeout reached, forcing loading to false");
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(safetyTimeout);
  }, [isLoading, authLoading]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    fetchJobs,
    setJobs
  };
};

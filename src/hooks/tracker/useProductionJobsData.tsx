
import { useState, useEffect, useCallback, useRef } from "react";
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
  
  const fetchJobsRef = useRef<boolean>(false);
  const lastFetchRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 2000; // Minimum 2 seconds between fetches

  const fetchJobs = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (fetchJobsRef.current) {
      console.log("Fetch already in progress, skipping");
      return;
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
      console.log("Rate limiting fetch, too soon since last fetch");
      return;
    }

    if (authLoading) {
      console.log("Auth still loading, skipping fetch");
      return;
    }

    if (!user?.id) {
      console.log("No user ID, setting empty jobs");
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    fetchJobsRef.current = true;
    lastFetchRef.current = now;

    try {
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
      fetchJobsRef.current = false;
    }
  }, [user?.id, authLoading]);

  // Optimized effect that only runs when auth is ready and user changes
  useEffect(() => {
    if (authLoading) {
      console.log("Auth loading, waiting...");
      return;
    }

    console.log("Auth ready, fetching jobs for user:", user?.id);
    fetchJobs();
  }, [user?.id, authLoading]); // Removed fetchJobs from dependencies to prevent loops

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    fetchJobs,
    setJobs
  };
};

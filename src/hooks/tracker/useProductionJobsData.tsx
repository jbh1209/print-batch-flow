
import { useState, useEffect } from "react";
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
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error("Error fetching production jobs:", fetchError);
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("Production jobs fetched:", data?.length || 0);
      setJobs(data || []);

    } catch (err) {
      console.error('Error fetching production jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    setJobs
  };
};

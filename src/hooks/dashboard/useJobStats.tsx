
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { filterActiveJobs } from "@/utils/tracker/jobCompletionUtils";

interface JobStats {
  pendingJobs: number;
  printedToday: number;
  isLoading: boolean;
  error: string | null;
}

export const useJobStats = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<JobStats>({
    pendingJobs: 0,
    printedToday: 0,
    isLoading: true,
    error: null
  });

  const fetchJobStats = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log("Fetching global job stats...");
      
      // Fetch pending jobs from all job tables, only selecting existing columns
      const [businessCardJobs, flyerJobs, postcardJobs, productionJobs] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("id, status", { count: 'exact' }),
        supabase.from("flyer_jobs").select("id, status", { count: 'exact' }),
        supabase.from("postcard_jobs").select("id, status", { count: 'exact' }),
        supabase.from("production_jobs").select("id, status", { count: 'exact' })
      ]);
      
      let totalPendingJobs = 0;
      
      // Count active jobs using unified completion logic
      if (businessCardJobs.status === 'fulfilled' && !businessCardJobs.value.error && businessCardJobs.value.data) {
        const activeJobs = filterActiveJobs(businessCardJobs.value.data);
        totalPendingJobs += activeJobs.filter(job => job.status === 'queued').length;
        console.log("Business card active jobs:", activeJobs.length);
      }
      
      if (flyerJobs.status === 'fulfilled' && !flyerJobs.value.error && flyerJobs.value.data) {
        const activeJobs = filterActiveJobs(flyerJobs.value.data);
        totalPendingJobs += activeJobs.filter(job => job.status === 'queued').length;
        console.log("Flyer active jobs:", activeJobs.length);
      }
      
      if (postcardJobs.status === 'fulfilled' && !postcardJobs.value.error && postcardJobs.value.data) {
        const activeJobs = filterActiveJobs(postcardJobs.value.data);
        totalPendingJobs += activeJobs.filter(job => job.status === 'queued').length;
        console.log("Postcard active jobs:", activeJobs.length);
      }

      if (productionJobs.status === 'fulfilled' && !productionJobs.value.error && productionJobs.value.data) {
        const activeJobs = filterActiveJobs(productionJobs.value.data);
        totalPendingJobs += activeJobs.length;
        console.log("Production active jobs:", activeJobs.length);
      }
      
      // Fetch completed jobs today - use unified completion logic
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const [completedBusinessCards, completedFlyers, completedPostcards, completedProduction] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("id, status").gte("updated_at", todayISO),
        supabase.from("flyer_jobs").select("id, status").gte("updated_at", todayISO),
        supabase.from("postcard_jobs").select("id, status").gte("updated_at", todayISO),
        supabase.from("production_jobs").select("id, status").gte("updated_at", todayISO)
      ]);
      
      let totalCompletedToday = 0;
      
      if (completedBusinessCards.status === 'fulfilled' && !completedBusinessCards.value.error && completedBusinessCards.value.data) {
        const completedJobs = completedBusinessCards.value.data.filter(job => 
          job.status === 'completed'
        );
        totalCompletedToday += completedJobs.length;
      }
      
      if (completedFlyers.status === 'fulfilled' && !completedFlyers.value.error && completedFlyers.value.data) {
        const completedJobs = completedFlyers.value.data.filter(job => 
          job.status === 'completed'
        );
        totalCompletedToday += completedJobs.length;
      }
      
      if (completedPostcards.status === 'fulfilled' && !completedPostcards.value.error && completedPostcards.value.data) {
        const completedJobs = completedPostcards.value.data.filter(job => 
          job.status === 'completed'
        );
        totalCompletedToday += completedJobs.length;
      }

      if (completedProduction.status === 'fulfilled' && !completedProduction.value.error && completedProduction.value.data) {
        const completedJobs = completedProduction.value.data.filter(job => 
          job.status?.toLowerCase().includes('completed') || 
          job.status?.toLowerCase().includes('shipped') ||
          job.status?.toLowerCase().includes('delivered')
        );
        totalCompletedToday += completedJobs.length;
      }
      
      console.log("Job stats calculated:", {
        totalPending: totalPendingJobs,
        completedToday: totalCompletedToday
      });
      
      setStats({
        pendingJobs: totalPendingJobs,
        printedToday: totalCompletedToday,
        isLoading: false,
        error: null
      });
      
    } catch (error) {
      console.error("Error fetching job stats:", error);
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to load job statistics"
      }));
      
      toast({
        title: "Error loading job statistics",
        description: "Failed to load job statistics. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    ...stats,
    refresh: fetchJobStats
  };
};

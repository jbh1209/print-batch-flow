
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BatchStats {
  activeBatches: number;
  bucketsFilled: number;
  batchTypeStats: {
    name: string;
    progress: number;
    total: number;
  }[];
  isLoading: boolean;
  error: string | null;
}

export const useBatchStats = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<BatchStats>({
    activeBatches: 0,
    bucketsFilled: 0,
    batchTypeStats: [],
    isLoading: true,
    error: null
  });

  const fetchBatchStats = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log("Fetching global batch stats...");
      
      // Fetch active batches (pending, processing)
      const { data: activeBatches, error: batchesError, count: activeBatchesCount } = await supabase
        .from("batches")
        .select("id", { count: 'exact' })
        .in("status", ["pending", "processing"]);
      
      if (batchesError) {
        console.error("Error fetching active batches:", batchesError);
        throw batchesError;
      }
      
      console.log("Active batches count:", activeBatchesCount);
      
      // Calculate batch type statistics - get pending jobs for each type
      const [businessCardJobs, flyerJobs, postcardJobs] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("id", { count: 'exact' }).eq("status", "queued"),
        supabase.from("flyer_jobs").select("id, size", { count: 'exact' }).eq("status", "queued"),
        supabase.from("postcard_jobs").select("id", { count: 'exact' }).eq("status", "queued")
      ]);
      
      let businessCardCount = 0;
      let flyerA5Count = 0;
      let flyerA4Count = 0;
      let postcardCount = 0;
      
      if (businessCardJobs.status === 'fulfilled' && !businessCardJobs.value.error) {
        businessCardCount = businessCardJobs.value.count || 0;
        console.log("Business card jobs:", businessCardCount);
      }
      
      if (flyerJobs.status === 'fulfilled' && !flyerJobs.value.error) {
        const flyerData = flyerJobs.value.data || [];
        flyerA5Count = flyerData.filter(job => job.size === "A5").length;
        flyerA4Count = flyerData.filter(job => job.size === "A4").length;
        console.log("Flyer A5 jobs:", flyerA5Count, "A4 jobs:", flyerA4Count);
      }
      
      if (postcardJobs.status === 'fulfilled' && !postcardJobs.value.error) {
        postcardCount = postcardJobs.value.count || 0;
        console.log("Postcard jobs:", postcardCount);
      }
      
      const batchTypeStats = [
        { name: "Business Cards", progress: businessCardCount, total: 50 },
        { name: "Flyers A5", progress: flyerA5Count, total: 50 },
        { name: "Flyers A4", progress: flyerA4Count, total: 50 },
        { name: "Postcards", progress: postcardCount, total: 50 }
      ];
      
      // Calculate buckets at capacity (>= 80%)
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;
      
      console.log("Batch stats calculated:", {
        activeBatches: activeBatchesCount || 0,
        bucketsFilled,
        batchTypeStats
      });
      
      setStats({
        activeBatches: activeBatchesCount || 0,
        bucketsFilled,
        batchTypeStats,
        isLoading: false,
        error: null
      });
      
    } catch (error) {
      console.error("Error fetching batch stats:", error);
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to load batch statistics"
      }));
      
      toast({
        title: "Error loading batch statistics",
        description: "Failed to load batch statistics. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]); // Only depend on toast

  return {
    ...stats,
    refresh: fetchBatchStats
  };
};

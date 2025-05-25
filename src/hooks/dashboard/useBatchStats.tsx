
import { useState } from "react";
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

export const useBatchStats = (userId: string | undefined) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<BatchStats>({
    activeBatches: 0,
    bucketsFilled: 0,
    batchTypeStats: [],
    isLoading: true,
    error: null
  });

  const fetchBatchStats = async () => {
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch active batches (pending, processing)
      const { data: activeBatches, error: batchesError } = await supabase
        .from("batches")
        .select("id, status")
        .in("status", ["pending", "processing"]);
      
      if (batchesError) throw batchesError;
      
      // Calculate batch type statistics - get pending jobs for each type
      const { data: pendingBusinessCardJobs } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("status", "queued");
        
      const { data: pendingFlyerJobs } = await supabase
        .from("flyer_jobs")
        .select("id, size")
        .eq("status", "queued");
      
      const batchTypeStats = [
        { name: "Business Cards", progress: pendingBusinessCardJobs?.length || 0, total: 50 },
        { name: "Flyers A5", progress: pendingFlyerJobs?.filter(job => job.size === "A5").length || 0, total: 50 },
        { name: "Flyers A4", progress: pendingFlyerJobs?.filter(job => job.size === "A4").length || 0, total: 50 },
        { name: "Postcards", progress: 0, total: 50 }
      ];
      
      // Calculate buckets at capacity (>= 80%)
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;
      
      console.log("Batch stats fetched:", {
        activeBatches: activeBatches?.length || 0,
        bucketsFilled,
        batchTypeStats
      });
      
      setStats({
        activeBatches: activeBatches?.length || 0,
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
  };

  return {
    ...stats,
    refresh: fetchBatchStats
  };
};

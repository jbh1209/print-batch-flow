
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
    if (!userId) return;
    
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch active batches
      const { data: activeBatches, error: batchesError } = await supabase
        .from("batches")
        .select("id")
        .eq("created_by", userId)
        .in("status", ["pending", "processing"]);
      
      if (batchesError) throw batchesError;
      
      // Calculate batch type statistics
      const { data: pendingBusinessCardJobs } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "queued");
        
      const { data: pendingFlyerJobs } = await supabase
        .from("flyer_jobs")
        .select("id, size")
        .eq("user_id", userId)
        .eq("status", "queued");
      
      const batchTypeStats = [
        { name: "Business Cards", progress: 0, total: 50 },
        { name: "Flyers A5", progress: 0, total: 50 },
        { name: "Flyers A4", progress: 0, total: 50 },
        { name: "Postcards", progress: 0, total: 50 }
      ];
      
      // Update progress for each type
      if (pendingBusinessCardJobs) {
        batchTypeStats[0].progress = pendingBusinessCardJobs.length;
      }
      
      if (pendingFlyerJobs) {
        const flyerA5Jobs = pendingFlyerJobs.filter(job => job.size === "A5");
        const flyerA4Jobs = pendingFlyerJobs.filter(job => job.size === "A4");
        batchTypeStats[1].progress = flyerA5Jobs?.length || 0;
        batchTypeStats[2].progress = flyerA4Jobs?.length || 0;
      }
      
      // Calculate buckets at capacity
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;
      
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

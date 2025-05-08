
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { castToUUID, safeDbMap, toSafeString } from "@/utils/database/dbHelpers";

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
      
      // Fetch active batches with cast IDs
      const { data: activeBatches, error: batchesError } = await supabase
        .from("batches")
        .select("id")
        .eq("created_by", castToUUID(userId))
        .in("status", ["pending", "processing"] as any);
      
      if (batchesError) throw batchesError;
      
      // Calculate batch type statistics
      const { data: pendingBusinessCardJobs } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", castToUUID(userId))
        .eq("status", castToUUID("queued") as any);
        
      const { data: pendingFlyerJobs } = await supabase
        .from("flyer_jobs")
        .select("id, size")
        .eq("user_id", castToUUID(userId))
        .eq("status", castToUUID("queued") as any);
      
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
        // Use safeDbMap for type-safe filtering
        const flyerJobsSafe = safeDbMap(pendingFlyerJobs, job => ({
          id: toSafeString(job.id),
          size: toSafeString(job.size)
        }));
        
        const flyerA5Jobs = flyerJobsSafe.filter(job => job.size === "A5");
        const flyerA4Jobs = flyerJobsSafe.filter(job => job.size === "A4");
        batchTypeStats[1].progress = flyerA5Jobs?.length || 0;
        batchTypeStats[2].progress = flyerA4Jobs?.length || 0;
      }
      
      // Calculate buckets at capacity
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;
      
      // Get active batches count safely
      const batchCount = activeBatches?.length || 0;
      
      setStats({
        activeBatches: batchCount,
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

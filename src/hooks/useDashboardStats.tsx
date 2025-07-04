
import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DashboardStats {
  // Job stats (global) - now batch-aware
  pendingJobs: number;
  individualJobs: number; // Jobs not in batches
  batchedJobs: number; // Jobs currently in batch processing
  printedToday: number;
  
  // Batch stats (global)
  activeBatches: number;
  bucketsFilled: number;
  batchTypeStats: {
    name: string;
    progress: number;
    total: number;
    batchCount: number; // Number of batches for this type
  }[];
  
  // Production job stats (from tracker system)
  productionJobStats: {
    total: number;
    inWorkflow: number;
    batchMasterJobs: number;
    individualInProgress: number;
  };
  
  // Activity stats (user-specific)
  recentActivity: {
    id: string;
    name: string;
    action: string;
    type: string;
    timestamp: string;
    isBatch?: boolean;
    batchName?: string;
  }[];
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    pendingJobs: 0,
    individualJobs: 0,
    batchedJobs: 0,
    printedToday: 0,
    activeBatches: 0,
    bucketsFilled: 0,
    batchTypeStats: [],
    productionJobStats: {
      total: 0,
      inWorkflow: 0,
      batchMasterJobs: 0,
      individualInProgress: 0
    },
    recentActivity: [],
    isLoading: true,
    error: null
  });

  const fetchStats = useCallback(async () => {
    if (authLoading || !user?.id) {
      setStats(prev => ({ ...prev, isLoading: false }));
      return;
    }
    
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log("Fetching enhanced dashboard stats with batch context...");
      
      // Fetch pending jobs (including batch context)
      const [businessCardResult, flyerResult, postcardResult] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("id, status, batch_id", { count: 'exact' }).eq("status", "queued"),
        supabase.from("flyer_jobs").select("id, status, batch_id", { count: 'exact' }).eq("status", "queued"),
        supabase.from("postcard_jobs").select("id, status, batch_id", { count: 'exact' }).eq("status", "queued")
      ]);
      
      const pendingJobs = [businessCardResult, flyerResult, postcardResult]
        .reduce((total, result) => {
          if (result.status === 'fulfilled' && !result.value.error) {
            return total + (result.value.count || 0);
          }
          return total;
        }, 0);

      // Count individual vs batched jobs
      let individualJobs = 0;
      let batchedJobs = 0;
      
      [businessCardResult, flyerResult, postcardResult].forEach(result => {
        if (result.status === 'fulfilled' && !result.value.error && result.value.data) {
          result.value.data.forEach(job => {
            if (job.batch_id) {
              batchedJobs++;
            } else {
              individualJobs++;
            }
          });
        }
      });
      
      // Fetch completed jobs today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const [completedBCResult, completedFlyerResult, completedPCResult] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("flyer_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("postcard_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO)
      ]);
      
      const printedToday = [completedBCResult, completedFlyerResult, completedPCResult]
        .reduce((total, result) => {
          if (result.status === 'fulfilled' && !result.value.error) {
            return total + (result.value.count || 0);
          }
          return total;
        }, 0);

      // Fetch active batches with more detailed info
      const { data: batchesData, count: activeBatches } = await supabase
        .from("batches")
        .select("id, name, status, lamination_type", { count: 'exact' })
        .in("status", ["pending", "processing"]);

      // Get production job stats from tracker system
      const { data: productionJobs } = await supabase
        .from("production_jobs")
        .select("id, wo_no, status, category_id");
      
      const productionJobStats = {
        total: productionJobs?.length || 0,
        inWorkflow: productionJobs?.filter(job => job.category_id || job.wo_no?.startsWith('BATCH-')).length || 0,
        batchMasterJobs: productionJobs?.filter(job => job.wo_no?.startsWith('BATCH-')).length || 0,
        individualInProgress: productionJobs?.filter(job => job.category_id && !job.wo_no?.startsWith('BATCH-') && job.status !== 'Completed').length || 0
      };

      // Enhanced batch type stats with actual batch counts
      const batchTypeCounts = new Map();
      if (batchesData) {
        batchesData.forEach(batch => {
          const type = batch.lamination_type || 'Other';
          batchTypeCounts.set(type, (batchTypeCounts.get(type) || 0) + 1);
        });
      }

      const batchTypeStats = [
        { 
          name: "Business Cards", 
          progress: Math.min(pendingJobs, 50), 
          total: 50,
          batchCount: batchTypeCounts.get('none') || 0
        },
        { 
          name: "Flyers A5", 
          progress: Math.min(flyerResult.status === 'fulfilled' ? (flyerResult.value.count || 0) : 0, 50), 
          total: 50,
          batchCount: batchTypeCounts.get('gloss') || 0
        },
        { 
          name: "Flyers A4", 
          progress: 0, 
          total: 50,
          batchCount: batchTypeCounts.get('matt') || 0
        },
        { 
          name: "Postcards", 
          progress: Math.min(postcardResult.status === 'fulfilled' ? (postcardResult.value.count || 0) : 0, 50), 
          total: 50,
          batchCount: batchTypeCounts.get('soft_touch') || 0
        }
      ];
      
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;

      // Fetch enhanced recent activity including batch context
      const { data: activityData } = await supabase
        .from("business_card_jobs")
        .select("id, name, status, updated_at, batch_id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      // Get batch names for recent activity
      const batchIds = (activityData || []).map(job => job.batch_id).filter(Boolean);
      let batchNames = new Map();
      
      if (batchIds.length > 0) {
        const { data: batches } = await supabase
          .from("batches")
          .select("id, name")
          .in("id", batchIds);
        
        if (batches) {
          batches.forEach(batch => {
            batchNames.set(batch.id, batch.name);
          });
        }
      }

      const recentActivity = (activityData || []).map(job => ({
        id: job.id,
        name: job.name || "Unnamed Job",
        action: "updated",
        type: job.batch_id ? "batch_job" : "job",
        timestamp: job.updated_at,
        isBatch: !!job.batch_id,
        batchName: job.batch_id ? batchNames.get(job.batch_id) : undefined
      }));
      
      console.log("Enhanced dashboard stats calculated:", {
        pendingJobs,
        individualJobs,
        batchedJobs,
        printedToday,
        activeBatches: activeBatches || 0,
        productionJobStats,
        bucketsFilled,
        recentActivity: recentActivity.length
      });
      
      setStats({
        pendingJobs,
        individualJobs,
        batchedJobs,
        printedToday,
        activeBatches: activeBatches || 0,
        bucketsFilled,
        batchTypeStats,
        productionJobStats,
        recentActivity,
        isLoading: false,
        error: null
      });
      
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to load dashboard statistics"
      }));
      
      toast.error("Failed to load dashboard statistics");
    }
  }, [user?.id, authLoading]);

  // Load stats when dependencies change
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    ...stats,
    refresh: fetchStats
  };
};

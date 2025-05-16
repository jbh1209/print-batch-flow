
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { useEffect } from "react";

// This hook extends useGenericJobs to handle flyer-specific data
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  // Use the generic jobs hook with the flyer config
  const genericJobs = useGenericJobs<FlyerJob>(config);
  
  // Always fetch fresh data when the hook is mounted
  useEffect(() => {
    // Fetch jobs immediately when the hook mounts
    genericJobs.fetchJobs();
    
    console.log("useGenericFlyerJobs hook initial fetch triggered");
  }, []);
  
  console.log("useGenericFlyerJobs hook executed, jobs count:", genericJobs.jobs.length);
  
  // Return the generic jobs hook with the right type
  return genericJobs;
}

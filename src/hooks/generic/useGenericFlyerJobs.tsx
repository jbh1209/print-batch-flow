
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

// This hook extends useGenericJobs to handle flyer-specific data
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  // Use the generic jobs hook with the flyer config
  const genericJobs = useGenericJobs<FlyerJob>(config);
  
  console.log("useGenericFlyerJobs hook executed, jobs count:", genericJobs.jobs.length);
  
  // Return the generic jobs hook with the right type
  return genericJobs;
}

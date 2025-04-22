
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

// This hook extends useGenericJobs to handle flyer-specific data
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  // Use type assertion to handle the compatibility between FlyerJob and BaseJob
  // This is safe because the structures match where they overlap for API usage
  return useGenericJobs<BaseJob>(config);
}

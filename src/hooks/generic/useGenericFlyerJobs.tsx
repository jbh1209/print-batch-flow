
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

// This hook extends useGenericJobs to handle flyer-specific data
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  // Use explicit typing and type casting to ensure compatibility
  const genericJobs = useGenericJobs<BaseJob>(config);
  
  // Cast the return value to maintain type consistency
  return genericJobs;
}

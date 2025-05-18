
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

// This hook extends useGenericJobs to handle flyer-specific data
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  // Use the hook without specifying generic type parameter
  const genericJobs = useGenericJobs(config);
  
  // Return the generic jobs hook
  return genericJobs;
}

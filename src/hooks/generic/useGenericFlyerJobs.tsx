
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

// This hook extends useGenericJobs to handle flyer-specific data
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  // Use the hook without explicitly specifying generic type
  const genericJobs = useGenericJobs(config);
  
  // Return the generic jobs hook with the right type
  return genericJobs;
}

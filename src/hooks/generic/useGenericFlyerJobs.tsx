
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";

// This hook extends BaseJob to maintain compatibility with FlyerJob
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  return useGenericJobs<BaseJob>(config);
}

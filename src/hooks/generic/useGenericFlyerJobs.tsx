
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  return useGenericJobs<FlyerJob>(config);
}

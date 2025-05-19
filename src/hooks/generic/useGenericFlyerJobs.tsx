
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";

/**
 * This hook is here for backward compatibility but is not
 * used by the main FlyerJobs component. The direct implementation
 * in useFlyerJobs.tsx is used instead.
 */
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  const genericJobs = useGenericJobs<BaseJob>(config);
  return genericJobs;
}


import { useEffect } from "react";
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { generateRenderKey } from "@/utils/cacheUtils";

// This hook extends useGenericJobs to handle flyer-specific data
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  const renderKey = generateRenderKey();
  
  // Use the generic jobs hook with the flyer config
  const genericJobs = useGenericJobs<FlyerJob>(config);
  
  // Always fetch fresh data when the hook is mounted
  useEffect(() => {
    console.log(`[useGenericFlyerJobs] Initial fetch triggered with key: ${renderKey}`);
    genericJobs.fetchJobs();
  }, []);
  
  console.log(`[useGenericFlyerJobs] Hook executed, jobs count: ${genericJobs.jobs.length}`);
  
  return {
    ...genericJobs,
    renderKey
  };
}


import React, { useState } from 'react';
import { productConfigs } from "@/config/productTypes";
import { useStandardJobs } from "@/hooks/generic/useStandardJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { toast } from "sonner";

/**
 * BoxJobsPage using standardized hooks with type validation
 */
const BoxJobsPage = () => {
  const config = productConfigs["Boxes"];
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  
  // Create a wrapper function that returns the standardized hook result
  const jobsHookWrapper = () => {
    const hookResult = useStandardJobs(config, {
      validateData: true,
      autoRefresh: autoRefreshEnabled,
      refreshInterval: 30000 // 30 seconds
    });
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that matches expected return type
    const fixBatchedJobsWrapper = async () => {
      try {
        const fixedCount = await hookResult.fixBatchedJobsWithoutBatch();
        if (fixedCount > 0) {
          toast.success(`Fixed ${fixedCount} orphaned batched jobs`);
        }
        return fixedCount;
      } catch (error) {
        console.error("Error fixing batched jobs:", error);
        return 0;
      }
    };
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default BoxJobsPage;

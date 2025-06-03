
import { ProductConfig } from '@/config/productTypes';

export const getJobDetailRoute = (config: ProductConfig, jobId: string): string => {
  const jobDetailPath = config.routes.jobDetailPath;
  if (typeof jobDetailPath === 'function') {
    return jobDetailPath(jobId);
  } else if (typeof jobDetailPath === 'string') {
    return `${jobDetailPath}/${jobId}`;
  }
  return '';
};

export const getJobEditRoute = (config: ProductConfig, jobId: string): string => {
  const jobEditPath = config.routes.jobEditPath;
  if (typeof jobEditPath === 'function') {
    return jobEditPath(jobId);
  } else if (typeof jobEditPath === 'string') {
    return `${jobEditPath}/${jobId}`;
  }
  return '';
};

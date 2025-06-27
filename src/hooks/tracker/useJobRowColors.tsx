
import { useState, useEffect } from 'react';
import { getDueStatusColor } from '@/utils/tracker/trafficLightUtils';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

export const useJobRowColors = (jobs: AccessibleJob[]) => {
  const [jobRowColors, setJobRowColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const calculateRowColors = async () => {
      const colorMap: Record<string, string> = {};
      
      for (const job of jobs) {
        try {
          // Only apply colors if job has both due date and category
          const hasCategory = job.category_name && job.category_name !== 'No Category';
          const hasDueDate = job.due_date;
          
          if (!hasCategory || !hasDueDate) {
            // Leave uncolored for admin to identify jobs needing attention
            colorMap[job.job_id] = '';
            continue;
          }
          
          const statusInfo = await getDueStatusColor(job.due_date);
          // Map traffic light colors to row background classes
          switch (statusInfo.code) {
            case 'red':
              colorMap[job.job_id] = 'bg-red-50 border-l-4 border-red-500';
              break;
            case 'yellow':
              colorMap[job.job_id] = 'bg-yellow-50 border-l-4 border-yellow-500';
              break;
            case 'green':
              colorMap[job.job_id] = 'bg-green-50 border-l-4 border-green-500';
              break;
            default:
              colorMap[job.job_id] = '';
          }
        } catch (error) {
          console.error('Error calculating row color for job:', job.job_id, error);
          colorMap[job.job_id] = '';
        }
      }
      
      setJobRowColors(colorMap);
    };

    if (jobs.length > 0) {
      calculateRowColors();
    }
  }, [jobs]);

  return jobRowColors;
};

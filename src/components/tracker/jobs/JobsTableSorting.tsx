
import React, { useMemo } from "react";

interface JobsTableSortingProps {
  jobs: any[];
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
}

export const useJobsTableSorting = ({ 
  jobs, 
  sortField, 
  sortOrder 
}: JobsTableSortingProps) => {
  // Sorting logic
  const sortedJobs = useMemo(() => {
    if (!sortField) return jobs;

    return [...jobs].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'wo_no':
          aValue = a.wo_no || '';
          bValue = b.wo_no || '';
          break;
        case 'customer':
          aValue = a.customer || '';
          bValue = b.customer || '';
          break;
        case 'reference':
          aValue = a.reference || '';
          bValue = b.reference || '';
          break;
        case 'qty':
          aValue = a.qty || 0;
          bValue = b.qty || 0;
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        case 'current_stage':
          aValue = a.current_stage || '';
          bValue = b.current_stage || '';
          break;
        default:
          return 0;
      }

      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string sorting
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [jobs, sortField, sortOrder]);

  return sortedJobs;
};

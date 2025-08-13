import React, { useMemo } from "react";
import { isAfter, startOfDay, addWeeks, startOfWeek } from "date-fns";
import { isBefore, endOfDay, isToday, endOfWeek } from "@/utils/date-polyfills";

interface JobsTableFiltersProps {
  jobs: any[];
  searchQuery: string;
  columnFilters: {
    woNumber: string;
    customer: string;
    reference: string;
    category: string;
    status: string;
    dueDate: string;
    currentStage: string;
  };
}

export const useJobsTableFilters = ({ 
  jobs, 
  searchQuery, 
  columnFilters 
}: JobsTableFiltersProps) => {
  // Extract unique values for filter dropdowns
  const availableCategories = useMemo(() => {
    const categories = [...new Set(jobs.map(job => job.category).filter(Boolean))];
    return categories.sort();
  }, [jobs]);

  const availableStatuses = useMemo(() => {
    const statuses = [...new Set(jobs.map(job => job.status).filter(Boolean))];
    return statuses.sort();
  }, [jobs]);

  const availableStages = useMemo(() => {
    const stages = [...new Set(jobs.map(job => job.current_stage).filter(Boolean))];
    return stages.sort();
  }, [jobs]);

  // Enhanced filtering logic
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          job.wo_no?.toLowerCase().includes(searchLower) ||
          job.customer?.toLowerCase().includes(searchLower) ||
          job.reference?.toLowerCase().includes(searchLower) ||
          job.category?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Column filters
      if (columnFilters.woNumber && !job.wo_no?.toLowerCase().includes(columnFilters.woNumber.toLowerCase())) {
        return false;
      }

      if (columnFilters.customer && !job.customer?.toLowerCase().includes(columnFilters.customer.toLowerCase())) {
        return false;
      }

      if (columnFilters.reference && !job.reference?.toLowerCase().includes(columnFilters.reference.toLowerCase())) {
        return false;
      }

      if (columnFilters.category && job.category !== columnFilters.category) {
        return false;
      }

      if (columnFilters.status && job.status !== columnFilters.status) {
        return false;
      }

      if (columnFilters.currentStage && job.current_stage !== columnFilters.currentStage) {
        return false;
      }

      // Due date filter
      if (columnFilters.dueDate && job.due_date) {
        const dueDate = new Date(job.due_date);
        const today = new Date();
        
        switch (columnFilters.dueDate) {
          case 'overdue':
            if (!isBefore(dueDate, startOfDay(today))) return false;
            break;
          case 'today':
            if (!isToday(dueDate)) return false;
            break;
          case 'thisWeek':
            const weekStart = startOfWeek(today);
            const weekEnd = endOfWeek(today);
            if (isBefore(dueDate, weekStart) || isAfter(dueDate, weekEnd)) return false;
            break;
          case 'nextWeek':
            const nextWeekStart = startOfWeek(addWeeks(today, 1));
            const nextWeekEnd = endOfWeek(addWeeks(today, 1));
            if (isBefore(dueDate, nextWeekStart) || isAfter(dueDate, nextWeekEnd)) return false;
            break;
          case 'noDate':
            if (job.due_date) return false;
            break;
        }
      } else if (columnFilters.dueDate === 'noDate' && job.due_date) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, columnFilters]);

  return {
    filteredJobs,
    availableCategories,
    availableStatuses,
    availableStages
  };
};

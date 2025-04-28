import { useState } from 'react';
import { ExtendedJob } from './useAllPendingJobs';

export const useJobFiltering = (jobs: ExtendedJob[]) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProductType, setFilterProductType] = useState<string>('all');
  const [sortField, setSortField] = useState<'due_date' | 'productType'>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = searchQuery === '' || 
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.job_number.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesProductType = filterProductType === 'all' || 
      job.productConfig.productType === filterProductType;
      
    return matchesSearch && matchesProductType;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortField === 'due_date') {
      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
      return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    } else if (sortField === 'productType') {
      return sortOrder === 'asc' 
        ? a.productConfig.productType.localeCompare(b.productConfig.productType)
        : b.productConfig.productType.localeCompare(a.productConfig.productType);
    }
    return 0;
  });

  const toggleSort = (field: 'due_date' | 'productType') => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Group jobs by urgency
  const criticalJobs = sortedJobs.filter(job => job.urgency === 'critical');
  const highJobs = sortedJobs.filter(job => job.urgency === 'high');
  const mediumJobs = sortedJobs.filter(job => job.urgency === 'medium');
  const lowJobs = sortedJobs.filter(job => job.urgency === 'low');

  return {
    searchQuery,
    setSearchQuery,
    filterProductType,
    setFilterProductType,
    sortField,
    sortOrder,
    toggleSort,
    sortedJobs,
    criticalJobs,
    highJobs,
    mediumJobs,
    lowJobs
  };
};

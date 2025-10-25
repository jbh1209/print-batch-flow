import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Users, Clock } from 'lucide-react';
import { useAccessibleJobs } from '@/hooks/tracker/useAccessibleJobs';
import { useDivision } from '@/contexts/DivisionContext';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

interface BatchAwareJobSearchProps {
  onJobSelect?: (job: AccessibleJob) => void;
  className?: string;
}

export const BatchAwareJobSearch: React.FC<BatchAwareJobSearchProps> = ({ 
  onJobSelect, 
  className = '' 
}) => {
  const { selectedDivision } = useDivision();
  const [searchTerm, setSearchTerm] = useState('');
  const { jobs, isLoading } = useAccessibleJobs({ 
    permissionType: 'view',
    divisionFilter: selectedDivision
  });

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    
    return jobs.filter(job => {
      // Search in basic job fields
      const basicMatch = [
        job.wo_no,
        job.customer,
        job.reference,
        job.status
      ].some(field => 
        field?.toLowerCase().includes(term)
      );
      
      // Search in batch-related fields
      const batchMatch = [
        job.batch_name,
        job.batch_category
      ].some(field => 
        field?.toLowerCase().includes(term)
      );
      
      return basicMatch || batchMatch;
    }).slice(0, 10); // Limit results
  }, [jobs, searchTerm]);

  const getBatchInfo = (job: AccessibleJob) => {
    if (job.is_batch_master) {
      return {
        type: 'Master Job',
        name: job.batch_name || 'Unknown Batch',
        color: 'bg-purple-100 text-purple-800',
        icon: Package,
        count: job.constituent_job_count
      };
    } else if (job.is_in_batch_processing || job.status === 'In Batch Processing') {
      return {
        type: 'In Batch',
        name: job.batch_name || 'Unknown Batch',
        color: 'bg-orange-100 text-orange-800',
        icon: Users
      };
    }
    return null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Batch Processing':
        return 'bg-orange-100 text-orange-800';
      case 'In Production':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Packaging':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4" />
          Batch-Aware Job Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs, batches, or customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {searchTerm.trim() && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="text-sm text-muted-foreground p-2 text-center">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2 text-center">
                No jobs found for "{searchTerm}"
              </div>
            ) : (
              searchResults.map((job) => {
                const batchInfo = getBatchInfo(job);
                
                return (
                  <Card 
                    key={job.job_id}
                    className="p-3 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => onJobSelect?.(job)}
                  >
                    <div className="space-y-2">
                      {/* Job Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{job.wo_no}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {job.customer}
                          </div>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getStatusColor(job.status)}`}
                        >
                          {job.status}
                        </Badge>
                      </div>

                      {/* Batch Information */}
                      {batchInfo && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <batchInfo.icon className="h-3 w-3" />
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium">{batchInfo.type}:</span>
                            <Badge 
                              variant="secondary" 
                              className={`${batchInfo.color} text-xs`}
                            >
                              {batchInfo.name}
                              {batchInfo.count && ` (${batchInfo.count} jobs)`}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* Current Stage & Due Date */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: job.current_stage_color }}
                          />
                          <span>{job.display_stage_name}</span>
                        </div>
                        {job.due_date && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(job.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  AlertTriangle, 
  Search,
  Filter,
  Clock,
  Play,
  CheckCircle
} from "lucide-react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { EnhancedOperatorJobCard } from "./EnhancedOperatorJobCard";
import { BarcodeScannerButton } from "./BarcodeScannerButton";
import { toast } from "sonner";

export const EnhancedOperatorDashboard = () => {
  const { isDtpOperator, accessibleStages } = useUserRole();
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: 'work'
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<'all' | 'my-active' | 'available' | 'urgent'>('available');
  const [refreshing, setRefreshing] = useState(false);

  // Filter stages for DTP operators
  const relevantStageIds = isDtpOperator 
    ? accessibleStages
        .filter(stage => 
          stage.stage_name.toLowerCase().includes('dtp') || 
          stage.stage_name.toLowerCase().includes('proof')
        )
        .map(stage => stage.stage_id)
    : accessibleStages.map(stage => stage.stage_id);

  // Filter jobs based on search and filter mode
  const filteredJobs = React.useMemo(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(job =>
        job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.customer && job.customer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (job.reference && job.reference.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply mode filter
    switch (filterMode) {
      case 'my-active':
        filtered = filtered.filter(job => 
          job.current_stage_status === 'active' && job.user_can_work
        );
        break;
      case 'available':
        filtered = filtered.filter(job => 
          job.current_stage_status === 'pending' && job.user_can_work
        );
        break;
      case 'urgent':
        filtered = filtered.filter(job => {
          const isOverdue = job.due_date && new Date(job.due_date) < new Date();
          const isDueSoon = job.due_date && !isOverdue && 
            new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          return isOverdue || isDueSoon;
        });
        break;
    }

    // Sort: active jobs first, then by urgency, then by due date
    return filtered.sort((a, b) => {
      if (a.current_stage_status === 'active' && b.current_stage_status !== 'active') return -1;
      if (b.current_stage_status === 'active' && a.current_stage_status !== 'active') return 1;
      
      const aOverdue = a.due_date && new Date(a.due_date) < new Date();
      const bOverdue = b.due_date && new Date(b.due_date) < new Date();
      if (aOverdue && !bOverdue) return -1;
      if (bOverdue && !aOverdue) return 1;
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      
      return 0;
    });
  }, [jobs, searchQuery, filterMode]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleHoldJob = useCallback(async (jobId: string, reason: string) => {
    try {
      // For now, just show success message - real implementation would call API
      toast.success(`Job held: ${reason}`);
      return true;
    } catch (error) {
      toast.error("Failed to hold job");
      return false;
    }
  }, []);

  const handleScanSuccess = useCallback((data: string) => {
    // Find job by WO number or other identifier
    const job = jobs.find(j => 
      j.wo_no.toLowerCase().includes(data.toLowerCase()) ||
      (j.reference && j.reference.toLowerCase().includes(data.toLowerCase()))
    );
    
    if (job) {
      setSearchQuery(data);
      toast.success(`Found job: ${job.wo_no}`);
      // Scroll to job would happen here
    } else {
      toast.warning(`No job found for: ${data}`);
    }
  }, [jobs]);

  const getFilterCounts = () => {
    return {
      all: jobs.length,
      available: jobs.filter(j => j.current_stage_status === 'pending' && j.user_can_work).length,
      'my-active': jobs.filter(j => j.current_stage_status === 'active' && j.user_can_work).length,
      urgent: jobs.filter(j => {
        const isOverdue = j.due_date && new Date(j.due_date) < new Date();
        const isDueSoon = j.due_date && !isOverdue && 
          new Date(j.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        return isOverdue || isDueSoon;
      }).length
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-700">Error Loading Jobs</h2>
            <p className="text-red-600 text-center mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filterCounts = getFilterCounts();

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isDtpOperator ? "DTP & Proofing Jobs" : "Factory Floor"}
            </h1>
            <p className="text-gray-600">
              {isDtpOperator ? "Jobs ready for DTP and proofing work" : "Jobs you can work on"}
            </p>
          </div>
          
          <div className="flex gap-2">
            <BarcodeScannerButton 
              onScanSuccess={handleScanSuccess}
              className="h-10"
            />
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-10"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs, customers, references..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Filter Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: 'available', label: 'Available', icon: Clock, count: filterCounts.available },
            { key: 'my-active', label: 'My Active', icon: Play, count: filterCounts['my-active'] },
            { key: 'urgent', label: 'Urgent', icon: AlertTriangle, count: filterCounts.urgent },
            { key: 'all', label: 'All Jobs', icon: CheckCircle, count: filterCounts.all }
          ].map((filter) => (
            <Button
              key={filter.key}
              onClick={() => setFilterMode(filter.key as any)}
              variant={filterMode === filter.key ? 'default' : 'outline'}
              className="h-16 flex flex-col items-center justify-center p-2"
            >
              <filter.icon className="h-5 w-5 mb-1" />
              <span className="font-semibold text-sm">{filter.label}</span>
              <Badge variant="secondary" className="text-xs mt-1">
                {filter.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-0">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Jobs Available</h3>
              <p className="text-gray-600 text-center">
                {searchQuery 
                  ? `No jobs found matching "${searchQuery}"`
                  : isDtpOperator 
                    ? "You don't have any DTP or proofing jobs available right now."
                    : "You don't have any jobs that you can work on right now."
                }
              </p>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery("")}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <EnhancedOperatorJobCard
              key={job.job_id}
              job={job}
              onStart={startJob}
              onComplete={completeJob}
              onHold={handleHoldJob}
            />
          ))
        )}
      </div>
    </div>
  );
};

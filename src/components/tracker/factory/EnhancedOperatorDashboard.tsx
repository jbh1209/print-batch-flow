import React, { useState, useCallback, useMemo } from "react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { DtpDashboard } from "./DtpDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  AlertTriangle, 
  Search,
  Clock,
  Play,
  CheckCircle
} from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { EnhancedOperatorJobCard } from "./EnhancedOperatorJobCard";
import { BarcodeScannerButton } from "./BarcodeScannerButton";
import { 
  categorizeJobs, 
  calculateFilterCounts, 
  sortJobsByPriority
} from "@/hooks/tracker/useAccessibleJobs/pureJobProcessor";
import { toast } from "sonner";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import type { DashboardFilters, FilterCounts } from "./types";

export const EnhancedOperatorDashboard = () => {
  const { isDtpOperator, accessibleStages } = useUserRole();
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: 'work'
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<DashboardFilters['filterMode']>('available');
  const [refreshing, setRefreshing] = useState(false);

  // For DTP operators, show the specialized dashboard
  if (isDtpOperator) {
    return <DtpDashboard />;
  }

  // Memoize relevant stage IDs to prevent unnecessary recalculations
  const relevantStageIds = useMemo(() => {
    return accessibleStages.map(stage => stage.stage_id);
  }, [accessibleStages]);

  // Memoize filtered jobs using consistent logic
  const filteredJobs = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];

    let filtered = [...jobs];

    console.log("🔍 Starting job filtering with", filtered.length, "jobs");

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(job =>
        job.wo_no?.toLowerCase().includes(query) ||
        job.customer?.toLowerCase().includes(query) ||
        job.reference?.toLowerCase().includes(query)
      );
    }

    // Get job categories using consistent logic
    const jobCategories = categorizeJobs(filtered);

    // Apply mode filter
    switch (filterMode) {
      case 'my-active':
        filtered = jobCategories.activeJobs.filter(job => job.user_can_work);
        break;
      case 'available':
        filtered = jobCategories.pendingJobs.filter(job => job.user_can_work);
        break;
      case 'urgent':
        filtered = jobCategories.urgentJobs;
        break;
      default:
        // Keep all filtered jobs
        break;
    }

    // Sort jobs by priority
    return sortJobsByPriority(filtered);
  }, [jobs, searchQuery, filterMode]);

  // Memoize filter counts using consistent logic
  const filterCounts: FilterCounts = useMemo(() => {
    return calculateFilterCounts(jobs);
  }, [jobs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshJobs();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  }, [refreshJobs]);

  const handleHoldJob = useCallback(async (jobId: string, reason: string) => {
    try {
      toast.success(`Job held: ${reason}`);
      return true;
    } catch (error) {
      toast.error("Failed to hold job");
      return false;
    }
  }, []);

  const handleScanSuccess = useCallback((data: string) => {
    const job = filteredJobs.find(j => 
      j.wo_no?.toLowerCase().includes(data.toLowerCase()) ||
      j.reference?.toLowerCase().includes(data.toLowerCase())
    );
    
    if (job) {
      setSearchQuery(data);
      toast.success(`Found job: ${job.wo_no}`);
    } else {
      toast.warning(`No job found for: ${data}`);
    }
  }, [filteredJobs]);

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

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Factory Floor</h1>
            <p className="text-gray-600">Jobs you can work on</p>
            <p className="text-sm text-gray-500">
              Showing {filteredJobs.length} jobs
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

        {/* Filter Buttons - Using consistent counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: 'my-active', label: 'My Active', icon: Play, count: filterCounts['my-active'] },
            { key: 'available', label: 'Available', icon: Clock, count: filterCounts.available },
            { key: 'urgent', label: 'Urgent', icon: AlertTriangle, count: filterCounts.urgent },
            { key: 'all', label: 'All Jobs', icon: CheckCircle, count: filterCounts.all }
          ].map((filter) => (
            <Button
              key={filter.key}
              onClick={() => setFilterMode(filter.key as DashboardFilters['filterMode'])}
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
              <p className="text-gray-600 text-center mb-4">
                {searchQuery 
                  ? `No jobs found matching "${searchQuery}"`
                  : `No jobs available in the "${filterMode}" filter.`
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

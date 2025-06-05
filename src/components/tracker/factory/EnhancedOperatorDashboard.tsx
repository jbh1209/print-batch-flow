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
  CheckCircle,
  Wifi,
  WifiOff
} from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { EnhancedOperatorJobCard } from "./EnhancedOperatorJobCard";
import { BarcodeScannerButton } from "./BarcodeScannerButton";
import { 
  categorizeJobs, 
  calculateFilterCounts, 
  sortJobsByPriority
} from "@/hooks/tracker/useAccessibleJobs/pureJobProcessor";
import { calculateDashboardMetrics } from "@/hooks/tracker/useAccessibleJobs/dashboardUtils";
import { toast } from "sonner";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import type { DashboardFilters, FilterCounts } from "./types";
import { JobListLoading, JobErrorState, EmptyJobsState } from "../common/JobLoadingStates";

export const EnhancedOperatorDashboard = () => {
  const { isDtpOperator, accessibleStages } = useUserRole();
  const { 
    jobs, 
    isLoading, 
    error, 
    startJob, 
    completeJob, 
    refreshJobs,
    hasOptimisticUpdates,
    hasPendingUpdates,
    lastFetchTime
  } = useAccessibleJobs({
    permissionType: 'work'
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<DashboardFilters['filterMode']>('available');
  const [refreshing, setRefreshing] = useState(false);

  // For DTP operators, show the specialized dashboard
  if (isDtpOperator) {
    return <DtpDashboard />;
  }

  // Calculate connection status
  const isConnected = lastFetchTime > 0 && (Date.now() - lastFetchTime) < 60000; // 1 minute

  // Memoize relevant stage IDs to prevent unnecessary recalculations
  const relevantStageIds = useMemo(() => {
    return accessibleStages.map(stage => stage.stage_id);
  }, [accessibleStages]);

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    return calculateDashboardMetrics(jobs);
  }, [jobs]);

  // Memoize filtered jobs using consistent logic
  const filteredJobs = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];

    try {
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
    } catch (filterError) {
      console.error("❌ Error filtering jobs:", filterError);
      toast.error("Error processing jobs filter");
      return [];
    }
  }, [jobs, searchQuery, filterMode]);

  // Memoize filter counts using consistent logic
  const filterCounts: FilterCounts = useMemo(() => {
    try {
      return calculateFilterCounts(jobs);
    } catch (countsError) {
      console.error("❌ Error calculating filter counts:", countsError);
      return { all: 0, available: 0, 'my-active': 0, urgent: 0 };
    }
  }, [jobs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshJobs();
      toast.success("Jobs refreshed successfully");
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      toast.error("Failed to refresh jobs");
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  }, [refreshJobs]);

  const handleHoldJob = useCallback(async (jobId: string, reason: string) => {
    try {
      toast.success(`Job held: ${reason}`);
      return true;
    } catch (error) {
      console.error("❌ Error holding job:", error);
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

  // Enhanced loading state
  if (isLoading) {
    return (
      <JobListLoading 
        message="Loading your jobs..."
        showProgress={true}
      />
    );
  }

  // Enhanced error handling
  if (error) {
    return (
      <div className="p-6">
        <JobErrorState
          error={error}
          onRetry={handleRefresh}
          title="Factory Floor Error"
        />
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
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-gray-500">
                Showing {filteredJobs.length} of {jobs.length} jobs
              </p>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
            </div>
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

        {/* Real-time status indicators */}
        {(hasOptimisticUpdates || hasPendingUpdates()) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-700">
              {hasOptimisticUpdates ? 'Processing updates...' : 'Syncing changes...'}
            </span>
          </div>
        )}

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

        {/* Enhanced Filter Buttons with metrics */}
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

        {/* Dashboard metrics summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{dashboardMetrics.pendingJobs}</div>
              <div className="text-sm text-blue-800">Pending</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-green-50 to-green-100">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{dashboardMetrics.activeJobs}</div>
              <div className="text-sm text-green-800">Active</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{dashboardMetrics.urgentJobs}</div>
              <div className="text-sm text-orange-800">Urgent</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{dashboardMetrics.averageProgress}%</div>
              <div className="text-sm text-purple-800">Avg Progress</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-0">
        {filteredJobs.length === 0 ? (
          <EmptyJobsState
            searchQuery={searchQuery}
            filterMode={filterMode}
            onClearSearch={() => setSearchQuery("")}
          />
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

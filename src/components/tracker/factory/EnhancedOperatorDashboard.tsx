import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { DtpDashboard } from "./DtpDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  RefreshCw, 
  AlertTriangle, 
  Search,
  Clock,
  Play,
  CheckCircle,
  Wifi,
  WifiOff,
  LogOut,
  Menu,
  Home
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { BulkJobOperations } from "@/components/tracker/common/BulkJobOperations";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import type { DashboardFilters, FilterCounts } from "./types";
import { JobListLoading, JobErrorState, EmptyJobsState } from "../common/JobLoadingStates";

export const EnhancedOperatorDashboard = () => {
  // All hooks must be called unconditionally at the top
  const { isDtpOperator, accessibleStages } = useUserRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();
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
  const [selectedJobs, setSelectedJobs] = useState<AccessibleJob[]>([]);
  const [showBulkOperations, setShowBulkOperations] = useState(false);

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

  // All callbacks and handlers
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

  const handleJobSelection = useCallback((job: AccessibleJob, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.job_id !== job.job_id));
    }
  }, []);

  const handleSelectAllVisible = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedJobs(filteredJobs);
    } else {
      setSelectedJobs([]);
    }
  }, [filteredJobs]);

  const handleClearSelection = useCallback(() => {
    setSelectedJobs([]);
    setShowBulkOperations(false);
  }, []);

  const handleBulkStart = useCallback(async (jobIds: string[]) => {
    try {
      const results = await Promise.allSettled(
        jobIds.map(jobId => {
          const job = jobs.find(j => j.job_id === jobId);
          return job?.current_stage_id ? startJob(jobId, job.current_stage_id) : Promise.resolve(false);
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      toast.success(`Started ${successful} of ${jobIds.length} jobs`);
      return true;
    } catch (error) {
      console.error("Bulk start failed:", error);
      toast.error("Failed to start jobs");
      return false;
    }
  }, [jobs, startJob]);

  const handleBulkComplete = useCallback(async (jobIds: string[]) => {
    try {
      const results = await Promise.allSettled(
        jobIds.map(jobId => {
          const job = jobs.find(j => j.job_id === jobId);
          return job?.current_stage_id ? completeJob(jobId, job.current_stage_id) : Promise.resolve(false);
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      toast.success(`Completed ${successful} of ${jobIds.length} jobs`);
      return true;
    } catch (error) {
      console.error("Bulk complete failed:", error);
      toast.error("Failed to complete jobs");
      return false;
    }
  }, [jobs, completeJob]);

  const handleBulkHold = useCallback(async (jobIds: string[], reason: string, notes?: string) => {
    try {
      // This would call a bulk hold API endpoint
      console.log("Bulk hold:", { jobIds, reason, notes });
      toast.success(`Held ${jobIds.length} jobs`);
      return true;
    } catch (error) {
      console.error("Bulk hold failed:", error);
      toast.error("Failed to hold jobs");
      return false;
    }
  }, []);

  // Show bulk operations toggle
  useEffect(() => {
    setShowBulkOperations(selectedJobs.length > 0);
  }, [selectedJobs.length]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      toast.error('Logout failed');
    }
  }, [signOut, navigate]);

  const handleNavigation = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Conditional renders after all hooks
  if (isDtpOperator) {
    return <DtpDashboard />;
  }

  if (isLoading) {
    return (
      <JobListLoading 
        message="Loading your jobs..."
        showProgress={true}
      />
    );
  }

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
      {/* Enhanced Header with Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu className="h-4 w-4 mr-2" />
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleNavigation('/tracker/dashboard')}>
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/tracker/kanban')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Production Kanban
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNavigation('/tracker/admin')}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div>
            <h1 className="text-2xl font-bold">Factory Floor</h1>
            <p className="text-gray-600">Jobs you can work on</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="h-10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Status and Connection Info */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">
              Showing {filteredJobs.length} of {jobs.length} jobs
            </p>
            {selectedJobs.length > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {selectedJobs.length} selected
              </Badge>
            )}
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

        {/* Bulk Operations */}
        {showBulkOperations && (
          <BulkJobOperations
            selectedJobs={selectedJobs}
            onBulkStart={handleBulkStart}
            onBulkComplete={handleBulkComplete}
            onBulkHold={handleBulkHold}
            onClearSelection={handleClearSelection}
          />
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

        {/* Job Selection Controls */}
        {filteredJobs.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedJobs.length === filteredJobs.length}
                onCheckedChange={handleSelectAllVisible}
              />
              <span className="text-sm text-gray-600">Select all visible</span>
            </div>
            {selectedJobs.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearSelection}
              >
                Clear selection
              </Button>
            )}
          </div>
        )}
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
            <div key={job.job_id} className="flex items-start gap-3">
              <Checkbox
                checked={selectedJobs.some(j => j.job_id === job.job_id)}
                onCheckedChange={(checked) => handleJobSelection(job, checked as boolean)}
                className="mt-6"
              />
              <div className="flex-1">
                <EnhancedOperatorJobCard
                  job={job}
                  onStart={startJob}
                  onComplete={completeJob}
                  onHold={handleHoldJob}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

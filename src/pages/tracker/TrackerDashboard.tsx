import React from "react";
import { Loader2 } from "lucide-react";
import { InteractiveOverviewStats } from "@/components/tracker/dashboard/InteractiveOverviewStats";
import { FilteredJobsList } from "@/components/tracker/dashboard/FilteredJobsList";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useCategories } from "@/hooks/tracker/useCategories";

const TrackerDashboard = () => {
  const {
    jobs,
    isLoading,
    error,
    refreshJobs,
    lastFetchTime
  } = useAccessibleJobs({
    permissionType: 'manage'
  });

  const { categories } = useCategories();

  // Dashboard filter state
  const [activeFilter, setActiveFilter] = React.useState<string | null>(null);

  // Local refresh UI state
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshJobs();
    setIsRefreshing(false);
  };

  const getTimeSinceLastUpdate = () => {
    if (!lastFetchTime) return null;
    const now = new Date();
    const ms = now.getTime() - lastFetchTime;
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  // Calculate comprehensive dashboard metrics
  const stats = React.useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return {
        total: 0,
        inProgress: 0,
        completed: 0,
        pending: 0,
        dueToday: 0,
        dueTomorrow: 0,
        dueThisWeek: 0,
        overdue: 0,
        critical: 0,
        completedThisMonth: 0,
        statusCounts: {},
        stages: []
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Calculate time-based metrics
    const dueToday = jobs.filter(job => {
      if (!job.due_date) return false;
      const dueDate = new Date(job.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    }).length;

    const dueTomorrow = jobs.filter(job => {
      if (!job.due_date) return false;
      const dueDate = new Date(job.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === tomorrow.getTime();
    }).length;

    const dueThisWeek = jobs.filter(job => {
      if (!job.due_date) return false;
      const dueDate = new Date(job.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate > today && dueDate <= weekFromNow;
    }).length;

    const overdue = jobs.filter(job => {
      if (!job.due_date || job.status === 'Completed') return false;
      const dueDate = new Date(job.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;

    // Completed this month
    const completedThisMonth = jobs.filter(job => {
      if (job.status !== 'Completed') return false;
      if (!job.updated_at) return false;
      const updatedDate = new Date(job.updated_at);
      return updatedDate >= monthStart;
    }).length;

    // Critical = overdue + due today + jobs with low progress and approaching due dates
    const critical = overdue + dueToday + jobs.filter(job => 
      job.workflow_progress && job.workflow_progress < 30 && job.due_date && 
      new Date(job.due_date) <= weekFromNow
    ).length;

    // Status counts by current stage status
    const inProgress = jobs.filter(job => 
      job.current_stage_status === 'active'
    ).length;

    const pending = jobs.filter(job => 
      job.current_stage_status === 'pending' || !job.current_stage_status
    ).length;

    const completed = jobs.filter(job => 
      job.status === 'Completed' || job.workflow_progress === 100
    ).length;

    // Build status counts from actual job statuses
    const statusCounts: Record<string, number> = {};
    jobs.forEach(job => {
      const status = job.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Get unique stages with counts
    const stageMap = new Map();
    jobs.forEach(job => {
      if (job.current_stage_name && job.current_stage_status !== 'completed') {
        const stageName = job.display_stage_name || job.current_stage_name;
        const existing = stageMap.get(stageName) || { 
          name: stageName, 
          color: job.current_stage_color || '#6B7280', 
          count: 0 
        };
        existing.count += 1;
        stageMap.set(stageName, existing);
      }
    });

    const stages = Array.from(stageMap.values()).sort((a, b) => b.count - a.count);

    return {
      total: jobs.length,
      inProgress,
      completed,
      pending,
      dueToday,
      dueTomorrow,
      dueThisWeek,
      overdue,
      critical,
      completedThisMonth,
      statusCounts,
      stages
    };
  }, [jobs]);

  // Filter jobs based on active filter
  const filteredJobs = React.useMemo(() => {
    if (!activeFilter || !jobs) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    switch (activeFilter) {
      case "overdue":
        return jobs.filter(job => {
          if (!job.due_date || job.status === 'Completed') return false;
          const dueDate = new Date(job.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate < today;
        });

      case "due_today":
        return jobs.filter(job => {
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        });

      case "due_tomorrow":
        return jobs.filter(job => {
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === tomorrow.getTime();
        });

      case "due_this_week":
        return jobs.filter(job => {
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate > today && dueDate <= weekFromNow;
        });

      case "critical":
        return jobs.filter(job => {
          const isOverdue = job.due_date && new Date(job.due_date) < today && job.status !== 'Completed';
          const isDueToday = job.due_date && new Date(job.due_date).setHours(0,0,0,0) === today.getTime();
          const isLowProgress = job.workflow_progress && job.workflow_progress < 30 && 
                               job.due_date && new Date(job.due_date) <= weekFromNow;
          return isOverdue || isDueToday || isLowProgress;
        });

      case "completed_this_month":
        return jobs.filter(job => {
          if (job.status !== 'Completed') return false;
          if (!job.updated_at) return false;
          const updatedDate = new Date(job.updated_at);
          return updatedDate >= monthStart;
        });

      case "in_progress":
        return jobs.filter(job => job.current_stage_status === 'active');

      case "total":
        return jobs;

      default:
        return [];
    }
  }, [jobs, activeFilter]);

  const handleFilterClick = (filter: string) => {
    if (activeFilter === filter) {
      setActiveFilter(null); // Toggle off if same filter clicked
    } else {
      setActiveFilter(filter);
    }
  };

  // Auto-refresh every 30 seconds for factory display
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshJobs();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshJobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <span className="text-xl font-medium">Loading dashboard...</span>
          <p className="text-gray-500 mt-2">Fetching production data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg max-w-2xl mx-auto mt-20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">Error loading dashboard</p>
              <p className="mt-2">{error}</p>
            </div>
            <RefreshIndicator
              lastUpdated={new Date(lastFetchTime)}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              getTimeSinceLastUpdate={getTimeSinceLastUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4 border-b shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Production Dashboard</h1>
          <p className="text-gray-600">Real-time production monitoring - Click stats to filter jobs</p>
        </div>
        <RefreshIndicator
          lastUpdated={new Date(lastFetchTime)}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          getTimeSinceLastUpdate={getTimeSinceLastUpdate}
        />
      </div>

      <div className="px-6 space-y-4">
        {/* Interactive Overview Stats */}
        <InteractiveOverviewStats 
          stats={stats} 
          activeFilter={activeFilter}
          onFilterClick={handleFilterClick}
        />

        {/* Filtered Jobs List */}
        {activeFilter && (
          <FilteredJobsList
            jobs={filteredJobs}
            activeFilter={activeFilter}
            onClose={() => setActiveFilter(null)}
            categories={categories}
          />
        )}

        {/* Keep existing breakdown and actions */}
        <TrackerStatusBreakdown stats={stats} />
        <TrackerQuickActions />
        {stats.total === 0 && <TrackerEmptyState />}
      </div>
    </div>
  );
};

export default TrackerDashboard;

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Clock, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Timer,
  Users,
  Settings,
  UserCheck,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduledJobs } from "@/hooks/tracker/useScheduledJobs";
import { useAuth } from "@/hooks/useAuth";
import { EnhancedScheduledOperatorJobCard } from "./EnhancedScheduledOperatorJobCard";
import { ConcurrentJobSelector } from "./ConcurrentJobSelector";
import { SupervisorOverrideModal } from "./SupervisorOverrideModal";
import { BatchStartModal } from "./BatchStartModal";
import { useConcurrentJobManagement } from "@/hooks/tracker/useConcurrentJobManagement";
import { toast } from "sonner";

interface SchedulerAwareOperatorDashboardProps {
  production_stage_id?: string;
  department_filter?: string;
}

export const SchedulerAwareOperatorDashboard: React.FC<SchedulerAwareOperatorDashboardProps> = ({
  production_stage_id,
  department_filter
}) => {
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [concurrentMode, setConcurrentMode] = useState(false);
  const [supervisorOverrideJob, setSupervisorOverrideJob] = useState<any>(null);
  const [showBatchStartModal, setShowBatchStartModal] = useState(false);
  
  const { 
    scheduledJobs, 
    jobsByReadiness, 
    isLoading, 
    error, 
    startScheduledJob, 
    completeScheduledJob, 
    refreshJobs,
    lastUpdate
  } = useScheduledJobs({ 
    production_stage_id,
    department_filter 
  });

  const {
    selectedJobs,
    isProcessing: concurrentProcessing,
    batchCompatibility,
    toggleJobSelection,
    clearSelection,
    startJobsBatch,
    startJobOutOfOrder,
    loadDepartmentRules
  } = useConcurrentJobManagement();

  // Load department rules on mount
  useEffect(() => {
    loadDepartmentRules();
  }, [loadDepartmentRules]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      toast.error('Logout failed');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshJobs();
      toast.success('Queue refreshed');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      toast.error('Failed to refresh queue');
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  const handleJobClick = (job: any) => {
    if (concurrentMode) {
      toggleJobSelection(job);
    } else {
      console.log('Job clicked:', job);
    }
  };

  const handleSupervisorOverride = (job: any) => {
    setSupervisorOverrideJob(job);
  };

  const handleApplySupervisorOverride = async (override: any) => {
    if (supervisorOverrideJob) {
      const success = await startJobOutOfOrder(supervisorOverrideJob, override);
      if (success) {
        setSupervisorOverrideJob(null);
        refreshJobs();
      }
    }
  };

  const handleStartBatch = async (options: any) => {
    const success = await startJobsBatch(options.supervisorOverride);
    if (success) {
      setShowBatchStartModal(false);
      refreshJobs();
    }
  };

  const stats = React.useMemo(() => {
    return {
      total: scheduledJobs.length,
      readyNow: jobsByReadiness.ready_now.length,
      scheduledLater: jobsByReadiness.scheduled_later.length,
      waitingDependencies: jobsByReadiness.waiting_dependencies.length,
      active: scheduledJobs.filter(j => j.status === 'active').length,
      selected: selectedJobs.length,
      compatible: selectedJobs.filter(j => j.isCompatible).length
    };
  }, [scheduledJobs, jobsByReadiness, selectedJobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <span className="text-xl font-medium text-gray-900">Loading production queue...</span>
          <p className="text-gray-600 mt-2">Fetching scheduled jobs from the system...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg max-w-2xl mx-auto mt-20">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="font-semibold text-xl">Production Queue Error</p>
            <p className="mt-2">{error}</p>
            <Button onClick={handleRefresh} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Production Queue
                {production_stage_id && (
                  <Badge variant="secondary" className="ml-2 text-sm">
                    Stage Specific
                  </Badge>
                )}
              </h1>
              <p className="text-gray-600">
                Welcome back, {user?.email?.split('@')[0] || 'Operator'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={concurrentMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setConcurrentMode(!concurrentMode);
                  if (concurrentMode) clearSelection();
                }}
                className="flex items-center gap-2"
              >
                <Layers className="h-4 w-4" />
                {concurrentMode ? 'Exit Multi-Select' : 'Multi-Select'}
              </Button>
              
              {selectedJobs.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowBatchStartModal(true)}
                  disabled={concurrentProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Start {selectedJobs.length} Jobs
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline" 
                size="sm"
                onClick={handleLogout}
              >
                <Users className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Jobs</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                </div>
                <Timer className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Ready Now</p>
                  <p className="text-2xl font-bold text-green-900">{stats.readyNow}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Active</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.active}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-700">Scheduled</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.scheduledLater}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Waiting</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.waitingDependencies}</p>
                </div>
                <Calendar className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>

          {/* Selected Jobs Stats (shown in concurrent mode) */}
          {concurrentMode && (
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-700">Selected</p>
                    <p className="text-2xl font-bold text-indigo-900">{stats.selected}</p>
                    {stats.selected > 0 && (
                      <p className="text-xs text-indigo-600">
                        {stats.compatible} compatible
                      </p>
                    )}
                  </div>
                  <Layers className="h-8 w-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Job Queue Tabs */}
        <Tabs defaultValue={concurrentMode ? "concurrent" : "ready"} className="w-full">
          <TabsList className={cn(
            "grid w-full",
            concurrentMode ? "grid-cols-5" : "grid-cols-4"
          )}>
            {concurrentMode && (
              <TabsTrigger value="concurrent" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Multi-Select ({stats.selected})
              </TabsTrigger>
            )}
            <TabsTrigger value="ready" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Ready Now ({stats.readyNow})
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Scheduled ({stats.scheduledLater})
            </TabsTrigger>
            <TabsTrigger value="waiting" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Waiting ({stats.waitingDependencies})
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Timer className="w-4 h-4" />
              All Jobs ({stats.total})
            </TabsTrigger>
          </TabsList>

          {/* Concurrent Job Selection Tab */}
          {concurrentMode && (
            <TabsContent value="concurrent" className="mt-6">
              <ConcurrentJobSelector
                availableJobs={jobsByReadiness.ready_now}
                selectedJobs={selectedJobs}
                onToggleSelection={toggleJobSelection}
                onClearSelection={clearSelection}
                onStartBatch={() => setShowBatchStartModal(true)}
                onRequestSupervisorOverride={handleSupervisorOverride}
                isProcessing={concurrentProcessing}
                batchCompatibility={batchCompatibility}
              />
            </TabsContent>
          )}

          <TabsContent value="ready" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsByReadiness.ready_now.map(job => (
                <EnhancedScheduledOperatorJobCard
                  key={job.id}
                  job={job}
                  onClick={concurrentMode ? handleJobClick : undefined}
                  onRefresh={refreshJobs}
                />
              ))}
              {jobsByReadiness.ready_now.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Ready</h3>
                  <p className="text-gray-600">All jobs are scheduled for later or waiting for dependencies.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsByReadiness.scheduled_later.map(job => (
                <EnhancedScheduledOperatorJobCard
                  key={job.id}
                  job={job}
                  onRefresh={refreshJobs}
                  showActions={false}
                />
              ))}
              {jobsByReadiness.scheduled_later.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Jobs</h3>
                  <p className="text-gray-600">No jobs are scheduled for later today.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="waiting" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsByReadiness.waiting_dependencies.map(job => (
                <EnhancedScheduledOperatorJobCard
                  key={job.id}
                  job={job}
                  onRefresh={refreshJobs}
                  showActions={false}
                />
              ))}
              {jobsByReadiness.waiting_dependencies.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Waiting Jobs</h3>
                  <p className="text-gray-600">All jobs are ready or scheduled.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheduledJobs.map(job => (
                <EnhancedScheduledOperatorJobCard
                  key={job.id}
                  job={job}
                  onRefresh={refreshJobs}
                />
              ))}
              {scheduledJobs.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Timer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs in Queue</h3>
                  <p className="text-gray-600">There are currently no jobs in the production queue.</p>
                  <Button onClick={handleRefresh} variant="outline" className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Queue
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <SupervisorOverrideModal
        isOpen={!!supervisorOverrideJob}
        onClose={() => setSupervisorOverrideJob(null)}
        job={supervisorOverrideJob}
        onApprove={handleApplySupervisorOverride}
        isProcessing={concurrentProcessing}
      />

      <BatchStartModal
        isOpen={showBatchStartModal}
        onClose={() => setShowBatchStartModal(false)}
        selectedJobs={selectedJobs}
        onStartBatch={handleStartBatch}
        isProcessing={concurrentProcessing}
        batchCompatibility={batchCompatibility}
      />
    </div>
  );
};
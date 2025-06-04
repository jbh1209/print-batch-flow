
import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Search,
  AlertTriangle,
  FileText,
  Play,
  CheckCircle,
  LogOut,
  Menu
} from "lucide-react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { DtpKanbanColumn } from "./DtpKanbanColumn";
import { BarcodeScannerButton } from "./BarcodeScannerButton";
import { DtpJobModal } from "./DtpJobModal";
import { toast } from "sonner";

export const DtpKanbanDashboard = () => {
  const { isDtpOperator, accessibleStages } = useUserRole();
  const { signOut } = useAuth();
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: 'work'
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);

  console.log("🎯 DTP Kanban Dashboard Debug:", {
    isDtpOperator,
    totalJobs: jobs.length,
    accessibleStages: accessibleStages.length,
    accessibleStageNames: accessibleStages.map(s => s.stage_name)
  });

  // Filter stages for DTP operators
  const dtpStageIds = useMemo(() => {
    return accessibleStages
      .filter(stage => stage.stage_name.toLowerCase().includes('dtp'))
      .map(stage => stage.stage_id);
  }, [accessibleStages]);

  const proofStageIds = useMemo(() => {
    return accessibleStages
      .filter(stage => stage.stage_name.toLowerCase().includes('proof'))
      .map(stage => stage.stage_id);
  }, [accessibleStages]);

  // Filter and categorize jobs with correct status logic
  const { dtpJobs, proofJobs } = useMemo(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(job =>
        job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.customer && job.customer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (job.reference && job.reference.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Separate DTP and Proof jobs
    const dtpJobs = filtered.filter(job => {
      if (!job.current_stage_id) return false;
      return dtpStageIds.includes(job.current_stage_id) ||
        (job.current_stage_name && job.current_stage_name.toLowerCase().includes('dtp'));
    });

    const proofJobs = filtered.filter(job => {
      if (!job.current_stage_id) return false;
      return proofStageIds.includes(job.current_stage_id) ||
        (job.current_stage_name && job.current_stage_name.toLowerCase().includes('proof'));
    });

    // Sort jobs: pending first (available to pick up), then active, then by due date
    const sortJobs = (jobsList: typeof filtered) => {
      return jobsList.sort((a, b) => {
        // Pending jobs first (available to start)
        if (a.current_stage_status === 'pending' && b.current_stage_status !== 'pending') return -1;
        if (b.current_stage_status === 'pending' && a.current_stage_status !== 'pending') return 1;
        
        // Then active jobs
        if (a.current_stage_status === 'active' && b.current_stage_status !== 'active') return -1;
        if (b.current_stage_status === 'active' && a.current_stage_status !== 'active') return 1;
        
        // Sort by due date
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        
        return 0;
      });
    };

    return {
      dtpJobs: sortJobs(dtpJobs),
      proofJobs: sortJobs(proofJobs)
    };
  }, [jobs, searchQuery, dtpStageIds, proofStageIds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleScanSuccess = useCallback((data: string) => {
    // Find job by WO number
    const allJobs = [...dtpJobs, ...proofJobs];
    const job = allJobs.find(j => 
      j.wo_no.toLowerCase().includes(data.toLowerCase()) ||
      (j.reference && j.reference.toLowerCase().includes(data.toLowerCase()))
    );
    
    if (job) {
      setSearchQuery(data);
      toast.success(`Found job: ${job.wo_no}`);
    } else {
      toast.warning(`No job found for: ${data}`);
    }
  }, [dtpJobs, proofJobs]);

  const handleJobClick = useCallback((job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowJobModal(false);
    setSelectedJob(null);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed');
    }
  }, [signOut]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading DTP jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center p-8 border border-red-200 bg-red-50 rounded-lg">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-red-700">Error Loading Jobs</h2>
          <p className="text-red-600 text-center mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-hidden bg-gray-50">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm">
            <Menu className="h-4 w-4 mr-2" />
            Menu
          </Button>
          <div>
            <h1 className="text-2xl font-bold">DTP Workstation</h1>
            <p className="text-gray-600">DTP and Proofing jobs</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
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

      {/* Content */}
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          Showing {dtpJobs.length} DTP jobs and {proofJobs.length} Proof jobs
        </p>

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

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">DTP Queue</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {dtpJobs.filter(j => j.current_stage_status === 'pending').length}
            </div>
            <div className="text-xs text-gray-500">Available to start</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">DTP Active</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {dtpJobs.filter(j => j.current_stage_status === 'active').length}
            </div>
            <div className="text-xs text-gray-500">In progress</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Proof Queue</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {proofJobs.filter(j => j.current_stage_status === 'pending').length}
            </div>
            <div className="text-xs text-gray-500">Ready for proofing</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Urgent</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {[...dtpJobs, ...proofJobs].filter(j => {
                const isOverdue = j.due_date && new Date(j.due_date) < new Date();
                const isDueSoon = j.due_date && !isOverdue && 
                  new Date(j.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                return isOverdue || isDueSoon;
              }).length}
            </div>
            <div className="text-xs text-gray-500">Due soon/overdue</div>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 h-full overflow-hidden">
        <DtpKanbanColumn
          title="DTP Jobs"
          jobs={dtpJobs}
          onStart={startJob}
          onComplete={completeJob}
          onJobClick={handleJobClick}
          colorClass="bg-blue-600"
          icon={<FileText className="h-4 w-4" />}
        />
        
        <DtpKanbanColumn
          title="Proofing Jobs"
          jobs={proofJobs}
          onStart={startJob}
          onComplete={completeJob}
          onJobClick={handleJobClick}
          colorClass="bg-purple-600"
          icon={<CheckCircle className="h-4 w-4" />}
        />
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <DtpJobModal
          job={selectedJob}
          isOpen={showJobModal}
          onClose={handleCloseModal}
          onStart={startJob}
          onComplete={completeJob}
        />
      )}
    </div>
  );
};

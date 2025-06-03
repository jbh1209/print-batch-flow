
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  Search,
  QrCode,
  Filter,
  RefreshCw,
  AlertTriangle,
  User,
  Calendar,
  Package
} from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useMobileQRScanner } from "@/hooks/tracker/useMobileQRScanner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MobileJobCardProps {
  job: any;
  onStart: (jobId: string) => void;
  onPause: (jobId: string) => void;
  onComplete: (jobId: string) => void;
  isActive?: boolean;
}

const MobileJobCard: React.FC<MobileJobCardProps> = ({
  job,
  onStart,
  onPause,
  onComplete,
  isActive = false
}) => {
  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const getCardStyle = () => {
    if (isActive) return "border-blue-500 bg-blue-50 shadow-lg";
    if (isOverdue) return "border-red-500 bg-red-50";
    if (isDueSoon) return "border-orange-500 bg-orange-50";
    return "border-gray-200 bg-white";
  };

  const getStatusIcon = () => {
    if (job.current_stage_status === 'active') return <Play className="h-5 w-5 text-blue-600" />;
    if (job.current_stage_status === 'completed') return <CheckCircle className="h-5 w-5 text-green-600" />;
    return <Clock className="h-5 w-5 text-gray-500" />;
  };

  return (
    <Card className={cn("mb-4 transition-all duration-200", getCardStyle())}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{job.wo_no}</h3>
              <p className="text-sm text-gray-600">{job.customer}</p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <Badge 
                variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                className="text-sm px-3 py-1"
              >
                {job.current_stage_name || 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Job Details */}
          <div className="grid grid-cols-1 gap-2 text-sm">
            {job.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className={cn(
                  "font-medium",
                  isOverdue ? "text-red-600" : 
                  isDueSoon ? "text-orange-600" : 
                  "text-gray-700"
                )}>
                  Due: {new Date(job.due_date).toLocaleDateString()}
                </span>
              </div>
            )}
            
            {job.reference && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">Ref: {job.reference}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${job.workflow_progress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 min-w-fit">
                {job.workflow_progress}%
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {job.current_stage_status === 'pending' && job.user_can_work && (
              <Button 
                onClick={() => onStart(job.job_id)}
                className="flex-1 h-12 text-lg font-semibold bg-green-600 hover:bg-green-700"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Job
              </Button>
            )}
            
            {job.current_stage_status === 'active' && job.user_can_work && (
              <>
                <Button 
                  onClick={() => onPause(job.job_id)}
                  variant="outline"
                  className="flex-1 h-12 text-lg font-semibold border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  <Pause className="h-5 w-5 mr-2" />
                  Hold
                </Button>
                <Button 
                  onClick={() => onComplete(job.job_id)}
                  className="flex-1 h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Complete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const MobileFactoryFloor: React.FC = () => {
  const { jobs, isLoading, startJob, completeJob, refreshJobs } = useAccessibleJobs();
  const { isScanning, startScanning, stopScanning, simulateScan } = useMobileQRScanner();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<'all' | 'my-active' | 'available' | 'urgent'>('available');
  const [activeJobs, setActiveJobs] = useState<string[]>([]);

  // Filter jobs based on current filter mode
  const filteredJobs = React.useMemo(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(job =>
        job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

    return filtered.sort((a, b) => {
      // Priority: active jobs first, then by due date
      if (a.current_stage_status === 'active' && b.current_stage_status !== 'active') return -1;
      if (b.current_stage_status === 'active' && a.current_stage_status !== 'active') return 1;
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  }, [jobs, searchQuery, filterMode]);

  const handleStartJob = async (jobId: string) => {
    try {
      const success = await startJob(jobId, "current_stage_id"); // You'll need to pass the actual stage ID
      if (success) {
        setActiveJobs(prev => [...prev, jobId]);
        toast.success("Job started successfully!");
      }
    } catch (error) {
      toast.error("Failed to start job");
    }
  };

  const handlePauseJob = async (jobId: string) => {
    // Implement pause functionality
    setActiveJobs(prev => prev.filter(id => id !== jobId));
    toast.info("Job paused");
  };

  const handleCompleteJob = async (jobId: string) => {
    try {
      const success = await completeJob(jobId, "current_stage_id"); // You'll need to pass the actual stage ID
      if (success) {
        setActiveJobs(prev => prev.filter(id => id !== jobId));
        toast.success("Job completed successfully!");
      }
    } catch (error) {
      toast.error("Failed to complete job");
    }
  };

  const handleScan = () => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning();
    }
  };

  const filterButtons = [
    { key: 'available', label: 'Available', count: jobs.filter(j => j.current_stage_status === 'pending' && j.user_can_work).length },
    { key: 'my-active', label: 'My Active', count: jobs.filter(j => j.current_stage_status === 'active' && j.user_can_work).length },
    { key: 'urgent', label: 'Urgent', count: jobs.filter(j => {
      const isOverdue = j.due_date && new Date(j.due_date) < new Date();
      const isDueSoon = j.due_date && !isOverdue && new Date(j.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      return isOverdue || isDueSoon;
    }).length },
    { key: 'all', label: 'All Jobs', count: jobs.length }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Factory Floor</h1>
            <Button 
              onClick={refreshJobs}
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search jobs, customers, references..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>

          {/* Filter Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {filterButtons.map((filter) => (
              <Button
                key={filter.key}
                onClick={() => setFilterMode(filter.key as any)}
                variant={filterMode === filter.key ? 'default' : 'outline'}
                className="h-12 flex flex-col items-center justify-center p-2"
              >
                <span className="font-semibold">{filter.label}</span>
                <span className="text-xs opacity-75">{filter.count} jobs</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="p-4">
        {filteredJobs.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No jobs found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search term' : 'No jobs match the current filter'}
            </p>
          </Card>
        ) : (
          <div className="space-y-0">
            {filteredJobs.map((job) => (
              <MobileJobCard
                key={job.job_id}
                job={job}
                onStart={handleStartJob}
                onPause={handlePauseJob}
                onComplete={handleCompleteJob}
                isActive={activeJobs.includes(job.job_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Scan Button */}
      <Button
        onClick={handleScan}
        className={cn(
          "fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-50",
          isScanning ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
        )}
      >
        <QrCode className="h-8 w-8" />
      </Button>
    </div>
  );
};

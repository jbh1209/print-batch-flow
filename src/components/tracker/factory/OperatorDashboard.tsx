
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Square, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Barcode,
  User,
  RefreshCw
} from "lucide-react";
import { useDepartments } from "@/hooks/tracker/useDepartments";
import { useFactoryFloor } from "@/hooks/tracker/useFactoryFloor";
import { useAuth } from "@/hooks/useAuth";
import { GlobalBarcodeListener } from "./GlobalBarcodeListener";
import { toast } from "sonner";

interface OperatorDashboardProps {
  selectedDepartmentId?: string;
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  selectedDepartmentId
}) => {
  const { user } = useAuth();
  const { userDepartments, isLoading: departmentsLoading } = useDepartments();
  const [activeDepartment, setActiveDepartment] = useState<string | undefined>(selectedDepartmentId);
  
  const {
    jobQueue,
    activeJobs,
    canStartNewJob,
    isLoading,
    startJob,
    completeJob,
    refreshQueue,
    refreshActiveJobs
  } = useFactoryFloor(activeDepartment);

  // Auto-select first department if user has only one
  useEffect(() => {
    if (!activeDepartment && userDepartments.length === 1) {
      setActiveDepartment(userDepartments[0].department_id);
    }
  }, [userDepartments, activeDepartment]);

  const handleStartJob = async (jobId: string, jobTableName: string) => {
    const success = await startJob(jobId, jobTableName);
    if (success) {
      await refreshQueue();
    }
  };

  const handleCompleteJob = async (activeJobId: string) => {
    const success = await completeJob(activeJobId);
    if (success) {
      await refreshActiveJobs();
    }
  };

  const handleBarcodeDetected = (barcodeData: string) => {
    toast.info(`Barcode detected: ${barcodeData}`);
    // Here you would implement the barcode-to-job logic
  };

  const getJobStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pre-press': return 'bg-blue-100 text-blue-800';
      case 'printing': return 'bg-yellow-100 text-yellow-800';
      case 'finishing': return 'bg-purple-100 text-purple-800';
      case 'packaging': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (departmentsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading operator dashboard...</span>
      </div>
    );
  }

  if (userDepartments.length === 0) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
          <h3 className="text-lg font-medium mb-2">No Department Assigned</h3>
          <p className="text-gray-600">
            You are not assigned to any departments. Please contact your manager to get assigned to a department.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentDepartment = userDepartments.find(d => d.department_id === activeDepartment);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <GlobalBarcodeListener onBarcodeDetected={handleBarcodeDetected} />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operator Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <User className="h-4 w-4" />
            <span className="text-gray-600">{user?.email}</span>
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={() => {
            refreshQueue();
            refreshActiveJobs();
          }}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Department Selection */}
      {userDepartments.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Select Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {userDepartments.map((dept) => (
                <Button
                  key={dept.department_id}
                  variant={activeDepartment === dept.department_id ? 'default' : 'outline'}
                  onClick={() => setActiveDepartment(dept.department_id)}
                  className="flex items-center gap-2"
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dept.department_color }}
                  />
                  {dept.department_name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeDepartment && (
        <>
          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-green-600" />
                  Active Jobs ({activeJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeJobs.map((activeJob) => {
                    const queueJob = jobQueue.find(j => j.job_id === activeJob.job_id);
                    return (
                      <div 
                        key={activeJob.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-blue-50"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{queueJob?.wo_no || 'Unknown Job'}</div>
                          <div className="text-sm text-gray-600">
                            {queueJob?.customer && `Customer: ${queueJob.customer}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Started: {new Date(activeJob.started_at).toLocaleTimeString()}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {queueJob?.current_stage && (
                            <Badge variant="outline">
                              {queueJob.current_stage}
                            </Badge>
                          )}
                          
                          <Button
                            onClick={() => handleCompleteJob(activeJob.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Queue */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Job Queue ({jobQueue.length})
                </div>
                {currentDepartment && (
                  <Badge variant="outline" className="text-xs">
                    {currentDepartment.allows_concurrent_jobs 
                      ? `Max ${currentDepartment.max_concurrent_jobs} concurrent`
                      : 'Single job only'
                    }
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p>Loading jobs...</p>
                </div>
              ) : jobQueue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p>No jobs in queue</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobQueue.map((job, index) => {
                    const isActive = activeJobs.some(aj => aj.job_id === job.job_id);
                    const canStart = canStartNewJob && !isActive && !job.is_blocked;
                    
                    return (
                      <div 
                        key={job.job_id}
                        className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                          isActive ? 'bg-blue-50 border-blue-200' :
                          job.is_blocked ? 'bg-gray-50 opacity-50' :
                          index === 0 && canStart ? 'bg-green-50 border-green-200' :
                          'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="font-medium text-lg">{job.wo_no}</div>
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                            >
                              #{job.priority_order}
                            </Badge>
                            {job.has_priority_override && (
                              <Badge variant="outline" className="text-xs bg-orange-50">
                                Priority Override
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-600 mt-1">
                            {job.customer && `Customer: ${job.customer}`}
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2">
                            <Badge className={getJobStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                            
                            {job.current_stage && (
                              <span className="text-xs text-gray-500">
                                Stage: {job.current_stage}
                              </span>
                            )}
                            
                            {job.due_date && (
                              <span className="text-xs text-gray-500">
                                Due: {new Date(job.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <Badge className="bg-blue-600 text-white">
                              In Progress
                            </Badge>
                          ) : job.is_blocked ? (
                            <Badge variant="outline" className="text-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Blocked
                            </Badge>
                          ) : canStart ? (
                            <Button
                              onClick={() => handleStartJob(job.job_id, job.job_table_name)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start Job
                            </Button>
                          ) : (
                            <Button variant="outline" disabled>
                              <Clock className="h-4 w-4 mr-2" />
                              Waiting
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Barcode Scanner Help */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Barcode className="h-6 w-6 text-blue-600" />
                <div>
                  <div className="font-medium text-blue-900">Barcode Scanner Ready</div>
                  <div className="text-sm text-blue-700">
                    Scan any job barcode to quickly navigate to that job and see available actions.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

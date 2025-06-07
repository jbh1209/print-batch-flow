
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, CheckCircle, AlertTriangle, Bug } from "lucide-react";
import { useSimpleJobAccess } from "@/hooks/tracker/useSimpleJobAccess";
import { useAuth } from "@/hooks/useAuth";
import { FactoryFloorDiagnostic } from "./FactoryFloorDiagnostic";

export const SimpleFactoryFloor = () => {
  const { user } = useAuth();
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useSimpleJobAccess();
  const [refreshing, setRefreshing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (showDiagnostics) {
    return <FactoryFloorDiagnostic />;
  }

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
            <div className="flex gap-2">
              <Button onClick={handleRefresh} variant="outline">
                Try Again
              </Button>
              <Button 
                onClick={() => setShowDiagnostics(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Bug className="h-4 w-4" />
                Run Diagnostics
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Factory Floor</h1>
          <p className="text-gray-600">Your accessible production jobs</p>
          <p className="text-sm text-gray-500 mt-1">
            Found {jobs.length} accessible job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowDiagnostics(true)}
            className="flex items-center gap-2"
          >
            <Bug className="h-4 w-4" />
            Diagnostics
          </Button>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Job Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Pending Jobs</p>
                <p className="text-2xl font-bold">
                  {jobs.filter(j => j.stage_status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Play className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold">
                  {jobs.filter(j => j.stage_status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Total Accessible</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs List */}
      {jobs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Accessible Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-lg">{job.wo_no}</h4>
                      <Badge 
                        variant={job.stage_status === 'active' ? 'default' : 'outline'}
                        className={job.stage_status === 'active' ? 'bg-green-500' : 'text-orange-600 border-orange-200'}
                      >
                        {job.current_stage_name}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {job.stage_status === 'active' ? 'Active' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span>Customer: {job.customer}</span>
                      {job.due_date && (
                        <span> • Due: {new Date(job.due_date).toLocaleDateString()}</span>
                      )}
                      <span> • Status: {job.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.stage_status === 'pending' && (
                      <Button 
                        size="sm"
                        onClick={() => startJob(job.id, job.current_stage_id)}
                        className="flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start
                      </Button>
                    )}
                    {job.stage_status === 'active' && (
                      <Button 
                        size="sm"
                        onClick={() => completeJob(job.id, job.current_stage_id)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Accessible Jobs Found</h3>
            <p className="text-gray-600 text-center mb-4">
              You don't have access to any jobs in the current production stages.
            </p>
            <p className="text-sm text-gray-500 text-center mb-6">
              This could be because:
              <br />• You're not assigned to any user groups
              <br />• Your groups don't have 'work' permissions on production stages
              <br />• No jobs are currently in stages you can access
            </p>
            <Button 
              onClick={() => setShowDiagnostics(true)}
              className="flex items-center gap-2"
            >
              <Bug className="h-4 w-4" />
              Run Diagnostics
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

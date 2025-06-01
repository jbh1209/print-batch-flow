
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Download, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { EnhancedJobsTableWithBulkActions } from "@/components/tracker/jobs/EnhancedJobsTableWithBulkActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";

const TrackerJobs = () => {
  const { jobs, isLoading } = useEnhancedProductionJobs();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Calculate job counts by status
  const getJobCountByStatus = (status: string) => {
    return jobs.filter(job => {
      if (status === 'in-progress') {
        return job.status && ['printing', 'finishing', 'production', 'pre-press', 'packaging'].includes(job.status.toLowerCase());
      }
      return job.status?.toLowerCase() === status.toLowerCase();
    }).length;
  };

  // Get production jobs (excluding completed)
  const productionJobsCount = jobs.filter(job => 
    job.status?.toLowerCase() !== 'completed'
  ).length;

  const overdue = jobs.filter(job => 
    job.due_date && new Date(job.due_date) < new Date() && job.status?.toLowerCase() !== 'completed'
  ).length;

  const pending = jobs.filter(job => 
    job.status?.toLowerCase() === 'pending' || !job.status
  ).length;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
        <div className="space-y-6">
          {/* Status Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Status Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant={!statusFilter ? "default" : "ghost"} 
                size="sm" 
                className="w-full justify-between text-xs h-8"
                onClick={() => setStatusFilter(null)}
              >
                <span>Production Jobs</span>
                <Badge variant="secondary" className="text-xs">
                  {productionJobsCount}
                </Badge>
              </Button>
              
              <Button 
                variant={statusFilter === 'completed' ? "default" : "ghost"} 
                size="sm" 
                className="w-full justify-between text-xs h-8"
                onClick={() => setStatusFilter('completed')}
              >
                <span>Completed</span>
                <Badge variant="secondary" className="text-xs">
                  {getJobCountByStatus('completed')}
                </Badge>
              </Button>
              
              <Button 
                variant={statusFilter === 'in-progress' ? "default" : "ghost"} 
                size="sm" 
                className="w-full justify-between text-xs h-8"
                onClick={() => setStatusFilter('in-progress')}
              >
                <span>In Progress</span>
                <Badge variant="secondary" className="text-xs">
                  {getJobCountByStatus('in-progress')}
                </Badge>
              </Button>
              
              <Button 
                variant={statusFilter === 'pending' ? "default" : "ghost"} 
                size="sm" 
                className="w-full justify-between text-xs h-8"
                onClick={() => setStatusFilter('pending')}
              >
                <span>Pending</span>
                <Badge variant="secondary" className="text-xs">
                  {pending}
                </Badge>
              </Button>
              
              <Button 
                variant={statusFilter === 'overdue' ? "default" : "ghost"} 
                size="sm" 
                className="w-full justify-between text-xs h-8"
                onClick={() => setStatusFilter('overdue')}
              >
                <span>Overdue</span>
                <Badge variant="destructive" className="text-xs">
                  {overdue}
                </Badge>
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" asChild>
                <Link to="/tracker/upload">
                  <Upload className="h-3 w-3 mr-2" />
                  Import Excel
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                <Download className="h-3 w-3 mr-2" />
                Export Jobs
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                <Plus className="h-3 w-3 mr-2" />
                Add Job
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold">Jobs Management</h1>
            <p className="text-gray-600">
              View and manage all production jobs with enhanced workflow tracking
            </p>
          </div>
        </div>

        <EnhancedJobsTableWithBulkActions statusFilter={statusFilter} />
      </div>
    </div>
  );
};

export default TrackerJobs;

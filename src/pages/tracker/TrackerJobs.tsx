
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

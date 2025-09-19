import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Package, Clock, CheckCircle, Plus, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { useFlyerBatches } from "@/hooks/useFlyerBatches";

interface FlyerOverviewProps {
  onTabChange?: (tab: string) => void;
}

export const FlyerOverview = ({ onTabChange }: FlyerOverviewProps) => {
  const { jobs, isLoading: jobsLoading } = useFlyerJobs();
  const { batches, isLoading: batchesLoading } = useFlyerBatches();

  const pendingJobs = jobs.filter(job => job.status === 'queued').length;
  const activeBatches = batches.filter(batch => batch.status === 'pending' || batch.status === 'in_progress').length;
  const completedBatches = batches.filter(batch => batch.status === 'completed').length;

  const isLoading = jobsLoading || batchesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Flyer Production Overview</h2>
        <p className="text-muted-foreground">Monitor your flyer jobs and batch production status</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : pendingJobs}
            </div>
            <p className="text-xs text-muted-foreground">
              Jobs awaiting batch allocation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : activeBatches}
            </div>
            <p className="text-xs text-muted-foreground">
              Batches in production
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Batches</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : completedBatches}
            </div>
            <p className="text-xs text-muted-foreground">
              Finished this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : jobs.length}
            </div>
            <p className="text-xs text-muted-foreground">
              All flyer jobs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Management
            </CardTitle>
            <CardDescription>
              Create and manage individual flyer print jobs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/printstream/batches/flyers/jobs/new" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Job
                </Link>
              </Button>
              <Button variant="outline" onClick={() => onTabChange?.('jobs')}>
                <Eye className="h-4 w-4" />
                View All Jobs
              </Button>
            </div>
            {pendingJobs > 0 && (
              <div className="text-sm text-muted-foreground">
                <Badge variant="secondary">{pendingJobs}</Badge> jobs pending batch allocation
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Batch Processing
            </CardTitle>
            <CardDescription>
              Group jobs into efficient production batches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button onClick={() => onTabChange?.('batches')}>
                <Eye className="h-4 w-4" />
                View All Batches
              </Button>
            </div>
            {activeBatches > 0 && (
              <div className="text-sm text-muted-foreground">
                <Badge variant="secondary">{activeBatches}</Badge> batches currently in production
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Production Specifications */}
      <Card>
        <CardHeader>
          <CardTitle>Production Specifications</CardTitle>
          <CardDescription>Common flyer specifications and requirements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Paper Types</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Gloss 150gsm</li>
                <li>• Matt 150gsm</li>
                <li>• Silk 150gsm</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Standard Sizes</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• A4 (210 x 297mm)</li>
                <li>• A5 (148 x 210mm)</li>
                <li>• DL (99 x 210mm)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Finishing Options</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• None</li>
                <li>• Matt Lamination</li>
                <li>• Gloss Lamination</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Users, 
  Settings,
  FileText,
  CheckCircle,
  Package,
  Printer,
  Clock
} from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { categorizeJobs } from "@/utils/tracker/jobProcessing";
import { DtpDashboardStats } from "./DtpDashboardStats";
import { TrackerErrorBoundary } from "../error-boundaries/TrackerErrorBoundary";

export const FactoryFloorView = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const { 
    jobs, 
    isLoading, 
    error, 
    refreshJobs 
  } = useAccessibleJobs({
    permissionType: 'work'
  });

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('❌ Logout failed:', error);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  // Categorize jobs for display
  const jobCategories = React.useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return { 
        dtpJobs: [], 
        proofJobs: [], 
        batchAllocationJobs: []
      };
    }
    
    const categories = categorizeJobs(jobs);
    
    // Extract batch allocation jobs
    const batchJobs = jobs.filter(job => {
      const stageName = job.current_stage_name?.toLowerCase() || '';
      return stageName.includes('batch allocation') || stageName.includes('batch_allocation');
    });
    
    return {
      dtpJobs: categories.dtpJobs,
      proofJobs: categories.proofJobs,
      batchAllocationJobs: batchJobs
    };
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-shrink-0 p-4 bg-white border-b">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mr-2" />
            <span>Loading factory floor...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-shrink-0 p-4 bg-white border-b">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-red-600 font-medium mb-2">Error loading factory floor</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button onClick={refreshJobs} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Factory Floor Dashboard</h1>
            <p className="text-gray-600">Production overview and job management</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshJobs}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigation('/tracker/admin')}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats */}
        <TrackerErrorBoundary componentName="Factory Floor Stats">
          <DtpDashboardStats
            dtpJobs={jobCategories.dtpJobs}
            proofJobs={jobCategories.proofJobs}
            batchAllocationJobs={jobCategories.batchAllocationJobs}
          />
        </TrackerErrorBoundary>
      </div>

      {/* Quick Actions */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* DTP Workflow */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <FileText className="h-5 w-5" />
                DTP Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-600 mb-3">
                Design, typesetting, and proofing workflow
              </p>
              <Button 
                onClick={() => handleNavigation('/tracker/dtp-workflow')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Open DTP Dashboard
              </Button>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-blue-600 text-white">
                  {jobCategories.dtpJobs.length} DTP Jobs
                </Badge>
                <Badge variant="outline" className="text-xs bg-purple-600 text-white">
                  {jobCategories.proofJobs.length} Proof Jobs
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Production Kanban */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Printer className="h-5 w-5" />
                Production Kanban
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-600 mb-3">
                Multi-stage production workflow management
              </p>
              <Button 
                onClick={() => handleNavigation('/tracker/kanban')}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Open Kanban Board
              </Button>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs bg-green-600 text-white">
                  {jobs.length} Active Jobs
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Batch Processing */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <Package className="h-5 w-5" />
                Batch Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-600 mb-3">
                Batch allocation and production scheduling
              </p>
              <Button 
                onClick={() => handleNavigation('/tracker/production')}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Manage Batches
              </Button>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs bg-orange-600 text-white">
                  {jobCategories.batchAllocationJobs.length} Batch Ready
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Recent job activity will appear here</p>
              <p className="text-sm mt-1">Start working on jobs to see real-time updates</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

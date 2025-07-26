
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Users, 
  Settings,
  FileText,
  CheckCircle,
  Package,
  Printer,
  Clock,
  BarChart3,
  AlertTriangle
} from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { categorizeJobs, calculateJobCounts } from "@/utils/tracker/jobProcessing";
import { DtpDashboardStats } from "./DtpDashboardStats";
import { TrackerErrorBoundary } from "../error-boundaries/TrackerErrorBoundary";
import { ProductionCalendar } from "@/components/production/ProductionCalendar";
import { toast } from "sonner";

export const EnhancedOperatorDashboard = () => {
  const { user, signOut } = useAuth();
  const { userRole, isOperator, isDtpOperator } = useUserRole();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  
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
      toast.success('Dashboard refreshed');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      toast.error('Failed to refresh dashboard');
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
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
        batchAllocationJobs: [],
        printingJobs: [],
        finishingJobs: []
      };
    }
    
    const categories = categorizeJobs(jobs);
    
    // Extract different job types
    const batchJobs = jobs.filter(job => {
      const stageName = job.current_stage_name?.toLowerCase() || '';
      return stageName.includes('batch allocation') || stageName.includes('batch_allocation');
    });

    const printingJobs = jobs.filter(job => {
      const stageName = job.current_stage_name?.toLowerCase() || '';
      return stageName.includes('print') && !stageName.includes('pre');
    });

    const finishingJobs = jobs.filter(job => {
      const stageName = job.current_stage_name?.toLowerCase() || '';
      return stageName.includes('cut') || stageName.includes('finish') || stageName.includes('pack');
    });
    
    return {
      dtpJobs: categories.dtpJobs,
      proofJobs: categories.proofJobs,
      batchAllocationJobs: batchJobs,
      printingJobs,
      finishingJobs
    };
  }, [jobs]);

  const jobStats = React.useMemo(() => {
    return calculateJobCounts(jobs);
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-shrink-0 p-4 bg-white border-b">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mr-2" />
            <span>Loading operator dashboard...</span>
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
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <p className="text-red-600 font-medium mb-2">Error loading dashboard</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button onClick={handleRefresh} variant="outline" size="sm">
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
            <h1 className="text-2xl font-bold text-gray-900">
              Operator Dashboard
              {userRole && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {userRole}
                </Badge>
              )}
            </h1>
            <p className="text-gray-600">Welcome back, {user?.email?.split('@')[0] || 'Operator'}</p>
          </div>
          <div className="flex items-center gap-2">
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
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <TrackerErrorBoundary componentName="Operator Dashboard Stats">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Jobs</p>
                    <p className="text-2xl font-bold text-blue-900">{jobStats.total}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Ready to Start</p>
                    <p className="text-2xl font-bold text-green-900">{jobStats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">In Progress</p>
                    <p className="text-2xl font-bold text-purple-900">{jobStats.active}</p>
                  </div>
                  <RefreshCw className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">{jobStats.completed}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TrackerErrorBoundary>
      </div>

      {/* Workflow Sections */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* DTP Workflow - Show for DTP operators */}
          {isDtpOperator && (
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
                    {jobCategories.dtpJobs.length} DTP
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-purple-600 text-white">
                    {jobCategories.proofJobs.length} Proof
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Production Workflow */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Printer className="h-5 w-5" />
                Production
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-600 mb-3">
                Printing and production workflow
              </p>
              <Button 
                onClick={() => handleNavigation('/tracker/kanban')}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Production Kanban
              </Button>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs bg-green-600 text-white">
                  {jobCategories.printingJobs.length} Printing
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
                Batch allocation and scheduling
              </p>
              <Button 
                onClick={() => handleNavigation('/tracker/production')}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Manage Batches
              </Button>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs bg-orange-600 text-white">
                  {jobCategories.batchAllocationJobs.length} Ready
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Production Schedule Calendar - Show for admin users */}
        {userRole === 'admin' && (
          <div className="mt-6">
            <ProductionCalendar />
          </div>
        )}

        {/* No Jobs State */}
        {jobs.length === 0 && (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Available</h3>
              <p className="text-gray-600 text-center max-w-md">
                There are currently no jobs assigned to you. Check with your supervisor or refresh the dashboard.
              </p>
              <Button onClick={handleRefresh} variant="outline" className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

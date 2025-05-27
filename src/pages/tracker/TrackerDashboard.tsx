
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  FileSpreadsheet, 
  Upload, 
  Kanban, 
  Table, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package
} from "lucide-react";
import { Link } from "react-router-dom";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { Loader2 } from "lucide-react";

const STATUSES = ["Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];

const TrackerDashboard = () => {
  const { jobs, isLoading, error, getJobStats } = useProductionJobs();
  const stats = getJobStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Error loading dashboard</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pre-Press": return <FileSpreadsheet className="h-4 w-4" />;
      case "Printing": return <BarChart3 className="h-4 w-4" />;
      case "Finishing": return <TrendingUp className="h-4 w-4" />;
      case "Packaging": return <Package className="h-4 w-4" />;
      case "Shipped": return <CheckCircle className="h-4 w-4" />;
      case "Completed": return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      "Pre-Press": "bg-blue-100 text-blue-800",
      "Printing": "bg-yellow-100 text-yellow-800",
      "Finishing": "bg-purple-100 text-purple-800", 
      "Packaging": "bg-orange-100 text-orange-800",
      "Shipped": "bg-green-100 text-green-800",
      "Completed": "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Production Tracker Dashboard</h1>
        <p className="text-gray-600">Monitor and manage your production workflow</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Active production jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.statusCounts["Pre-Press"] || 0) + 
               (stats.statusCounts["Printing"] || 0) + 
               (stats.statusCounts["Finishing"] || 0) + 
               (stats.statusCounts["Packaging"] || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Jobs being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.statusCounts["Completed"] || 0) + (stats.statusCounts["Shipped"] || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Finished jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pre-Press</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.statusCounts["Pre-Press"] || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs by Status</CardTitle>
          <CardDescription>Current distribution of jobs across workflow stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {STATUSES.map(status => (
              <div key={status} className="text-center">
                <Badge className={`mb-2 ${getStatusColor(status)}`}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(status)}
                    {status}
                  </span>
                </Badge>
                <div className="text-2xl font-bold">{stats.statusCounts[status] || 0}</div>
                <div className="text-xs text-gray-500">jobs</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Upload Excel
            </CardTitle>
            <CardDescription>Import jobs from Excel file</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/tracker/upload">Upload File</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Kanban className="h-5 w-5 text-green-600" />
              Kanban Board
            </CardTitle>
            <CardDescription>Drag & drop job management</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/tracker/kanban">Open Kanban</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5 text-purple-600" />
              Jobs Table
            </CardTitle>
            <CardDescription>Tabular view of all jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/tracker/jobs">View Table</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-orange-600" />
              Work Sheets
            </CardTitle>
            <CardDescription>Generate work documents</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/tracker/worksheets">Open Sheets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {stats.total === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Upload className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Jobs Found</h3>
            <p className="text-gray-600 mb-4">
              Get started by uploading an Excel file with your production jobs
            </p>
            <Button asChild>
              <Link to="/tracker/upload">Upload Excel File</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrackerDashboard;

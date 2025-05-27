
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Kanban, Table, FileSpreadsheet, ArrowLeft, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const TrackerDashboard = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Apps
            </Link>
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Production Tracker</h1>
          <p className="text-gray-600 mb-6">Manage and track your production jobs</p>
          
          <div className="flex justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/tracker/upload">Upload Excel File</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/tracker/kanban">View Kanban Board</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Upload className="h-6 w-6 mb-2" />
            </div>
            <CardTitle>Upload Jobs</CardTitle>
            <CardDescription>Import production jobs from Excel files</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link to="/tracker/upload">Upload Excel</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Kanban className="h-6 w-6 mb-2" />
            </div>
            <CardTitle>Kanban Board</CardTitle>
            <CardDescription>Drag-and-drop job status management</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link to="/tracker/kanban">Open Kanban</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Table className="h-6 w-6 mb-2" />
            </div>
            <CardTitle>Jobs Table</CardTitle>
            <CardDescription>View and edit jobs in table format</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link to="/tracker/jobs">View Table</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <FileSpreadsheet className="h-6 w-6 mb-2" />
            </div>
            <CardTitle>Work Sheets</CardTitle>
            <CardDescription>Generate printable work orders</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link to="/tracker/worksheets">Generate Sheets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Jobs</span>
                <span className="font-semibold">-</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">In Progress</span>
                <span className="font-semibold">-</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Overdue</span>
                <span className="font-semibold text-red-600">-</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed Today</span>
                <span className="font-semibold text-green-600">-</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest job updates and changes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-center py-8">
              Upload your first Excel file to start tracking jobs
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrackerDashboard;

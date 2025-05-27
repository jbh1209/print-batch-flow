
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Kanban, Table, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";

export const TrackerQuickActions = () => {
  return (
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
  );
};

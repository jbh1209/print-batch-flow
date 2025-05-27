
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Filter, Download, Eye, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const STATUSES = ["All", "Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];

const TrackerJobs = () => {
  const { jobs, isLoading, error } = useProductionJobs();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Filter jobs based on search and status
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Jobs Table</h1>
          <p className="text-gray-600">View and manage all production jobs in table format</p>
        </div>

        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading jobs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Jobs Table</h1>
        </div>

        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <p className="font-medium">Error loading jobs</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Jobs Table</h1>
        <p className="text-gray-600">View and manage all production jobs in table format</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow mb-6 p-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by WO Number, Customer, or Reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-sm text-gray-600">
            {filteredJobs.length} of {jobs.length} jobs
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg border shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    {jobs.length === 0 ? (
                      <div>
                        <p>No jobs found</p>
                        <p className="text-sm mt-1">Upload an Excel file to start tracking jobs</p>
                      </div>
                    ) : (
                      <p>No jobs match your search criteria</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job) => (
                  <TableRow key={job.id} className={job.highlighted ? "bg-yellow-50" : ""}>
                    <TableCell className="font-medium">{job.wo_no}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{job.customer || "-"}</TableCell>
                    <TableCell>{job.category || "-"}</TableCell>
                    <TableCell>{job.qty || "-"}</TableCell>
                    <TableCell>{formatDate(job.due_date)}</TableCell>
                    <TableCell>{job.location || "-"}</TableCell>
                    <TableCell>{job.rep || "-"}</TableCell>
                    <TableCell>{job.reference || "-"}</TableCell>
                    <TableCell>
                      {job.qr_code_url ? (
                        <QrCode className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="text-gray-400 text-xs">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {job.qr_code_url && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(job.qr_code_url!, '_blank')}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No jobs found</p>
          <p className="text-gray-400 text-sm mb-6">Upload an Excel file to start tracking jobs</p>
          <Button asChild>
            <Link to="/tracker/upload">Upload Excel File</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default TrackerJobs;

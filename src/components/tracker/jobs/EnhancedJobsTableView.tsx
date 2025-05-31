
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  QrCode,
  Play,
  Pause,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter,
  RefreshCw
} from "lucide-react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";

interface EnhancedJobsTableViewProps {
  filters?: {
    search?: string;
    filters?: string[];
  };
}

export const EnhancedJobsTableView: React.FC<EnhancedJobsTableViewProps> = ({ 
  filters = {} 
}) => {
  const { jobs, categories, isLoading, refreshJobs } = useEnhancedProductionJobs();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
      case 'printing':
      case 'finishing':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'on-hold':
      case 'pending':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || 'unknown';
    const variants = {
      'completed': 'success' as const,
      'in-progress': 'default' as const,
      'printing': 'default' as const,
      'finishing': 'default' as const,
      'on-hold': 'secondary' as const,
      'pending': 'secondary' as const,
      'overdue': 'destructive' as const
    };
    
    return (
      <Badge variant={variants[statusLower] || 'secondary'} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const isDueSoon = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    return due <= soon && due >= new Date();
  };

  // Filter jobs based on search and filters
  const filteredJobs = jobs.filter(job => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        job.wo_no.toLowerCase().includes(searchLower) ||
        job.customer?.toLowerCase().includes(searchLower) ||
        job.reference?.toLowerCase().includes(searchLower) ||
        job.category?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Status filters
    if (filters.filters && filters.filters.length > 0) {
      const hasStatusFilter = filters.filters.some(f => 
        ['completed', 'in-progress', 'pending', 'overdue'].includes(f)
      );
      
      if (hasStatusFilter) {
        const jobStatus = job.status?.toLowerCase() || 'unknown';
        const statusMatches = filters.filters.some(f => {
          if (f === 'overdue') return isOverdue(job.due_date);
          if (f === 'in-progress') return ['printing', 'finishing', 'in-progress'].includes(jobStatus);
          return jobStatus === f;
        });
        
        if (!statusMatches) return false;
      }

      // Due date filters
      if (filters.filters.includes('today')) {
        const today = new Date().toDateString();
        if (job.due_date && new Date(job.due_date).toDateString() !== today) return false;
      }
    }

    return true;
  });

  const handleJobSelect = (jobId: string, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedJobs(filteredJobs.map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  const renderTableView = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Production Jobs</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshJobs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Total: {jobs.length}</span>
          <span>Filtered: {filteredJobs.length}</span>
          <span>Selected: {selectedJobs.length}</span>
          {selectedJobs.length > 0 && (
            <Button variant="outline" size="sm">
              Bulk Actions ({selectedJobs.length})
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </TableHead>
              <TableHead>Work Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.map((job) => (
              <TableRow 
                key={job.id}
                className={`
                  ${isOverdue(job.due_date) ? 'bg-red-50 border-red-200' : ''}
                  ${isDueSoon(job.due_date) ? 'bg-orange-50 border-orange-200' : ''}
                `}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedJobs.includes(job.id)}
                    onChange={(e) => handleJobSelect(job.id, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{job.wo_no}</TableCell>
                <TableCell>{job.customer || 'Unknown'}</TableCell>
                <TableCell>
                  {job.category ? (
                    <Badge variant="outline">{job.category}</Badge>
                  ) : (
                    <Badge variant="secondary">No Category</Badge>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(job.status)}</TableCell>
                <TableCell>
                  {job.due_date ? (
                    <span className={`
                      ${isOverdue(job.due_date) ? 'text-red-600 font-medium' : ''}
                      ${isDueSoon(job.due_date) ? 'text-orange-600 font-medium' : ''}
                    `}>
                      {new Date(job.due_date).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-gray-400">No due date</span>
                  )}
                </TableCell>
                <TableCell>
                  {job.has_workflow ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                      {job.current_stage && (
                        <span className="text-sm text-gray-600">{job.current_stage}</span>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline">Not Initialized</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border shadow-lg z-50">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Job
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <QrCode className="h-4 w-4 mr-2" />
                        Generate QR
                      </DropdownMenuItem>
                      {!job.has_workflow && (
                        <DropdownMenuItem>
                          <Play className="h-4 w-4 mr-2" />
                          Initialize Workflow
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No jobs found</p>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Jobs</h1>
          <p className="text-gray-600">Manage and track all production work orders</p>
        </div>
        
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'table' | 'cards')}>
          <TabsList>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="cards">Card View</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={viewMode}>
        <TabsContent value="table">
          {renderTableView()}
        </TabsContent>
        <TabsContent value="cards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{job.wo_no}</CardTitle>
                    {getStatusBadge(job.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div><strong>Customer:</strong> {job.customer || 'Unknown'}</div>
                    <div><strong>Category:</strong> {job.category || 'No Category'}</div>
                    <div><strong>Due Date:</strong> {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'Not set'}</div>
                    <div><strong>Workflow:</strong> {job.has_workflow ? 'Active' : 'Not Initialized'}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

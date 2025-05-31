
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Calendar, User, Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FilteredJobsViewProps {
  jobs: any[];
  selectedStage?: string;
  isLoading?: boolean;
}

export const FilteredJobsView: React.FC<FilteredJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': case 'printing': case 'finishing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-6 text-center">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
        <p className="text-gray-500">
          {selectedStage 
            ? `No jobs currently in the ${selectedStage} stage.`
            : 'No jobs match the current filters.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {selectedStage ? `${selectedStage} Stage` : 'All Jobs'} ({jobs.length})
        </h2>
        {selectedStage && (
          <p className="text-sm text-gray-600">
            Jobs currently in the {selectedStage} production stage
          </p>
        )}
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {/* Job Header - SiteFlow Style */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-sm text-gray-900">
                      {job.wo_no} - {job.customer || 'No Customer'}
                    </h3>
                    <Badge className={`text-xs ${getStatusColor(job.status)}`}>
                      {job.status}
                    </Badge>
                  </div>

                  {/* Job Details */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span>Qty: {job.qty || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Due: {formatDate(job.due_date)}</span>
                    </div>
                    
                    {job.reference && (
                      <div className="flex items-center gap-1">
                        <span>Ref: {job.reference}</span>
                      </div>
                    )}
                    
                    {job.category && (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {job.category}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Current Stage Progress */}
                  {job.current_stage && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="text-xs text-gray-500">Current:</div>
                      <Badge variant="outline" className="text-xs">
                        {job.current_stage}
                      </Badge>
                    </div>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>Edit Job</DropdownMenuItem>
                    <DropdownMenuItem>Advance Stage</DropdownMenuItem>
                    <DropdownMenuItem>Generate QR</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

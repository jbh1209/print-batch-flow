
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Calendar, 
  User, 
  MapPin,
  Hash
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobOverviewCardProps {
  job: AccessibleJob;
}

export const JobOverviewCard: React.FC<JobOverviewCardProps> = ({ job }) => {
  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Job Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium">Work Order:</span>
              <span className="font-bold">{job.wo_no}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium">Customer:</span>
              <span>{job.customer || 'Unknown'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium">Status:</span>
              <Badge variant="outline">{job.status}</Badge>
            </div>
          </div>

          <div className="space-y-3">
            {job.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">Due Date:</span>
                <span className={
                  isOverdue ? "text-red-600 font-bold" : 
                  isDueSoon ? "text-orange-600 font-medium" : 
                  "text-gray-700"
                }>
                  {new Date(job.due_date).toLocaleDateString()}
                </span>
              </div>
            )}

            {job.category_name && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: job.category_color || '#6B7280' }}
                />
                <span className="text-sm font-medium">Category:</span>
                <span>{job.category_name}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Progress:</span>
              <span className="font-bold">{job.workflow_progress}%</span>
              <span className="text-xs text-gray-500">
                ({job.completed_stages}/{job.total_stages} stages)
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

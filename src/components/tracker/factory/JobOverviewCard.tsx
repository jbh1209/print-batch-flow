
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
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
          <FileText className="h-5 w-5" />
          Job Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Work Order</label>
            <p className="text-lg font-semibold">{job.wo_no}</p>
          </div>
          {job.customer && (
            <div>
              <label className="text-sm font-medium text-gray-600">Customer</label>
              <p className="text-lg">{job.customer}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {job.reference && (
            <div>
              <label className="text-sm font-medium text-gray-600">Reference</label>
              <p>{job.reference}</p>
            </div>
          )}
          {job.category_name && (
            <div>
              <label className="text-sm font-medium text-gray-600">Category</label>
              <p>{job.category_name}</p>
            </div>
          )}
        </div>

        {job.due_date && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">Due Date:</span>
            <span className={cn(
              "font-medium",
              isOverdue ? "text-red-600" : 
              isDueSoon ? "text-orange-600" : 
              "text-gray-900"
            )}>
              {new Date(job.due_date).toLocaleDateString()}
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                Overdue
              </Badge>
            )}
            {isDueSoon && !isOverdue && (
              <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                Due Soon
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

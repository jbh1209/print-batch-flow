
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Play, Package, Settings } from "lucide-react";
import { format } from "date-fns";

interface ResponsiveJobTableRowProps {
  job: any;
  isSelected: boolean;
  onSelectJob: (job: any, selected: boolean) => void;
  onEditJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onWorkflowInit: (job: any) => void;
  onDeleteJob: (jobId: string) => void;
  onPartAssignment?: (job: any) => void;
}

export const ResponsiveJobTableRow: React.FC<ResponsiveJobTableRowProps> = ({
  job,
  isSelected,
  onSelectJob,
  onEditJob,
  onCategoryAssign,
  onWorkflowInit,
  onDeleteJob,
  onPartAssignment
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'active': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on_hold': 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getStageBadge = (stageName: string, stageColor: string) => {
    return {
      backgroundColor: stageColor || '#e5e7eb',
      color: '#1f2937'
    };
  };

  return (
    <TableRow>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectJob(job, checked as boolean)}
        />
      </TableCell>
      <TableCell className="font-medium">{job.wo_no}</TableCell>
      <TableCell>{job.customer}</TableCell>
      <TableCell>{job.reference}</TableCell>
      <TableCell>
        <Badge className={getStatusBadge(job.status)}>
          {job.status}
        </Badge>
      </TableCell>
      <TableCell>
        {job.category_name && (
          <Badge 
            variant="outline"
            style={{ backgroundColor: job.category_color, color: '#1f2937' }}
          >
            {job.category_name}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {job.current_stage_name && (
          <Badge 
            variant="outline"
            style={getStageBadge(job.current_stage_name, job.current_stage_color)}
          >
            {job.current_stage_name}
          </Badge>
        )}
      </TableCell>
      <TableCell>{formatDate(job.due_date)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {job.completed_stages}/{job.total_stages}
          </span>
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${job.workflow_progress}%` }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditJob(job)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Job
            </DropdownMenuItem>
            
            {!job.category_id && (
              <DropdownMenuItem onClick={() => onCategoryAssign(job)}>
                <Play className="h-4 w-4 mr-2" />
                Assign Category
              </DropdownMenuItem>
            )}
            
            {!job.category_id && (
              <DropdownMenuItem onClick={() => onWorkflowInit(job)}>
                <Settings className="h-4 w-4 mr-2" />
                Initialize Workflow
              </DropdownMenuItem>
            )}
            
            {job.category_id && onPartAssignment && (
              <DropdownMenuItem onClick={() => onPartAssignment(job)}>
                <Package className="h-4 w-4 mr-2" />
                Assign Parts
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={() => onDeleteJob(job.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

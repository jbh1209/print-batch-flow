import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MoreHorizontal, 
  Edit, 
  QrCode, 
  FolderOpen,
  Play,
  Trash2,
  Settings,
  Package
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || 'unknown';
    const variants = {
      'completed': 'default' as const,
      'in-progress': 'secondary' as const,
      'printing': 'secondary' as const,
      'finishing': 'secondary' as const,
      'on-hold': 'outline' as const,
      'pending': 'outline' as const,
      'overdue': 'destructive' as const
    };
    
    return (
      <Badge variant={variants[statusLower] || 'outline'} className="text-xs">
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const [actionPending, setActionPending] = React.useState(false);

  const handleAction = (action: () => void, e: React.MouseEvent) => {
    if (actionPending) return;
    setActionPending(true);
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      setActionPending(false);
      action();
    }, 200);
  };

  const handleEditClick = (e: React.MouseEvent) =>
    handleAction(() => onEditJob(job), e);

  const handleCategoryAssignClick = (e: React.MouseEvent) =>
    handleAction(() => onCategoryAssign(job), e);

  const handleWorkflowInitClick = (e: React.MouseEvent) =>
    handleAction(() => onWorkflowInit(job), e);

  const handleDeleteClick = (e: React.MouseEvent) =>
    handleAction(() => onDeleteJob(job.id), e);

  const handlePartAssignmentClick = (e: React.MouseEvent) =>
    handleAction(() => onPartAssignment?.(job), e);

  const handleQRCodeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('QR Code action for job:', job.id);
    // TODO: Implement QR code functionality
  };

  return (
    <TableRow className={`
      ${isOverdue ? 'bg-red-50 border-red-100' : ''}
      ${isDueSoon ? 'bg-orange-50 border-orange-100' : ''}
      hover:bg-gray-50 transition-colors
    `}>
      <TableCell className="px-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectJob(job, checked as boolean)}
        />
      </TableCell>
      
      <TableCell className="font-medium text-sm">{job.wo_no}</TableCell>
      
      <TableCell className="text-sm">{job.customer || 'No customer'}</TableCell>
      
      <TableCell className="text-sm">{job.reference || '-'}</TableCell>
      
      <TableCell className="text-sm">{job.qty || '-'}</TableCell>
      
      <TableCell>
        {job.category ? (
          <div className="flex items-center space-x-1">
            <Badge variant="outline" className="text-xs">{job.category}</Badge>
            {job.has_custom_workflow && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                <Settings className="h-3 w-3 mr-1" />
                Custom
              </Badge>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCategoryAssignClick}
            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
          >
            Assign
          </Button>
        )}
      </TableCell>
      
      <TableCell>{getStatusBadge(job.status)}</TableCell>
      
      <TableCell>
        <span className={`text-sm ${
          isOverdue ? 'text-red-600 font-medium' : 
          isDueSoon ? 'text-orange-600 font-medium' : 
          'text-gray-600'
        }`}>
          {formatDate(job.due_date)}
        </span>
      </TableCell>
      
      <TableCell>
        {job.current_stage ? (
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {job.current_stage}
            </Badge>
            {job.workflow_progress && (
              <span className="text-xs text-gray-500">
                {job.workflow_progress.completed}/{job.workflow_progress.total}
              </span>
            )}
          </div>
        ) : job.has_workflow ? (
          <span className="text-xs text-gray-500">No active stage</span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleWorkflowInitClick}
            className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
          >
            <Play className="h-3 w-3 mr-1" />
            Init
          </Button>
        )}
      </TableCell>
      
      <TableCell>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-3 w-3" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" sideOffset={5}>
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            
            <DropdownMenuItem onClick={handleEditClick} className="text-xs cursor-pointer">
              <Edit className="h-3 w-3 mr-2" />
              Edit Job
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={handleQRCodeClick} className="text-xs cursor-pointer">
              <QrCode className="h-3 w-3 mr-2" />
              QR Code
            </DropdownMenuItem>
            
            {onPartAssignment && (
              <DropdownMenuItem onClick={handlePartAssignmentClick} className="text-xs cursor-pointer">
                <Package className="h-3 w-3 mr-2" />
                Assign Parts
              </DropdownMenuItem>
            )}
            
            {!job.category && (
              <DropdownMenuItem onClick={handleCategoryAssignClick} className="text-xs cursor-pointer">
                <FolderOpen className="h-3 w-3 mr-2" />
                Assign Category
              </DropdownMenuItem>
            )}
            
            {!job.has_workflow && (
              <DropdownMenuItem onClick={handleWorkflowInitClick} className="text-xs cursor-pointer">
                <Play className="h-3 w-3 mr-2" />
                {job.category ? 'Initialize Workflow' : 'Create Workflow'}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleDeleteClick} 
              onSelect={(e) => e.preventDefault()}
              className="text-xs text-red-600 hover:text-red-700 cursor-pointer"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

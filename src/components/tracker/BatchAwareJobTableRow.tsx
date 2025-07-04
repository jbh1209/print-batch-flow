import React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Edit, 
  Tags, 
  QrCode, 
  Trash2, 
  Settings,
  Package2,
  Users,
  ExternalLink,
  Split
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BatchContextIndicator } from "./BatchAwareJobCard";

interface BatchAwareJobTableRowProps {
  job: {
    id: string;
    wo_no: string;
    customer?: string | null;
    reference?: string | null;
    qty?: number | null;
    due_date?: string | null;
    status: string;
    category_name?: string | null;
    category_color?: string | null;
    current_stage_name?: string | null;
    current_stage_status?: string | null;
    
    // Batch context
    is_batch_master?: boolean;
    batch_name?: string | null;
    batch_status?: string | null;
    constituent_jobs_count?: number;
    batch_ready?: boolean;
    
    // Legacy fields for compatibility
    categories?: { name: string; color?: string };
    category_id?: string | null;
    has_custom_workflow?: boolean;
    current_stage_id?: string | null;
  };
  isSelected: boolean;
  onSelect: (job: any, selected: boolean) => void;
  onEdit: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onCustomWorkflow: (job: any) => void;
  onDelete: (jobId: string) => void;
  onBatchSplit?: (job: any) => void;
  onViewBatch?: (batchName: string) => void;
  showBatchActions?: boolean;
}

/**
 * Enhanced job table row with comprehensive batch awareness
 * Shows batch context, appropriate actions, and visual indicators
 */
export const BatchAwareJobTableRow: React.FC<BatchAwareJobTableRowProps> = ({
  job,
  isSelected,
  onSelect,
  onEdit,
  onCategoryAssign,
  onCustomWorkflow,
  onDelete,
  onBatchSplit,
  onViewBatch,
  showBatchActions = true
}) => {
  const handleCheckboxChange = (checked: boolean) => {
    onSelect(job, checked);
  };

  const handleMenuItemClick = (action: () => void) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        action();
      }, 100);
    };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No due date";
    try {
      return format(new Date(dateString), "M/d/yyyy");
    } catch {
      return "Invalid date";
    }
  };

  const getCategoryDisplay = () => {
    const hasCustomWorkflow = job.has_custom_workflow === true || 
      (job.category_id === null && job.current_stage_id && job.current_stage_id !== '00000000-0000-0000-0000-000000000000') ||
      (job.category_id === null && job.current_stage_name && job.current_stage_name !== 'No Stage');
    
    if (hasCustomWorkflow) {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Custom Workflow</Badge>;
    }
    
    const categoryName = job.categories?.name || job.category_name;
    const categoryColor = job.categories?.color || job.category_color;
    
    if (categoryName) {
      return (
        <Badge 
          variant="outline"
          style={{ 
            borderColor: categoryColor || undefined,
            color: categoryColor || undefined 
          }}
        >
          {categoryName}
        </Badge>
      );
    }
    
    return (
      <Button
        variant="link"
        size="sm"
        className="text-blue-600 hover:text-blue-800 p-0 h-auto"
        onClick={(e) => {
          e.stopPropagation();
          onCategoryAssign(job);
        }}
      >
        Assign Category
      </Button>
    );
  };

  const getCurrentStage = () => {
    if (!job.current_stage_name) return "Not Started";
    return job.current_stage_name;
  };

  const getRowStyle = () => {
    let baseStyle = "hover:bg-gray-50 transition-colors";
    
    if (job.is_batch_master) {
      baseStyle += " bg-purple-25 border-l-4 border-l-purple-400";
    } else if (job.batch_name) {
      baseStyle += " bg-blue-25 border-l-4 border-l-blue-400";
    } else if (job.batch_ready) {
      baseStyle += " bg-green-25 border-l-4 border-l-green-400";
    }
    
    return baseStyle;
  };

  const hasCustomWorkflow = job.has_custom_workflow === true || 
    (job.category_id === null && job.current_stage_id && job.current_stage_id !== '00000000-0000-0000-0000-000000000000') ||
    (job.category_id === null && job.current_stage_name && job.current_stage_name !== 'No Stage');

  return (
    <tr className={getRowStyle()}>
      <td className="px-6 py-4 whitespace-nowrap">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
        />
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900">{job.wo_no}</div>
          {job.is_batch_master && (
            <Badge className="bg-purple-600 text-white text-xs">
              MASTER
            </Badge>
          )}
        </div>
      </td>
      
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{job.customer || "N/A"}</div>
      </td>
      
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{job.reference || "N/A"}</div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-900">{job.qty || "N/A"}</div>
          {job.is_batch_master && job.constituent_jobs_count && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
              {job.constituent_jobs_count} jobs
            </Badge>
          )}
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        {getCategoryDisplay()}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-1">
          <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
            {job.status || 'Pre-Press'}
          </Badge>
          <BatchContextIndicator 
            job={job} 
            size="sm" 
            showDetails={false}
          />
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{formatDate(job.due_date)}</div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant="outline" className="text-xs">
          {getCurrentStage()}
        </Badge>
      </td>
      
      {/* Batch Context Column */}
      <td className="px-6 py-4 whitespace-nowrap">
        {job.batch_name && !job.is_batch_master && (
          <Button
            variant="link"
            size="sm"
            className="text-blue-600 hover:text-blue-800 p-0 h-auto text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onViewBatch?.(job.batch_name!);
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            {job.batch_name}
          </Button>
        )}
        {job.is_batch_master && (
          <div className="text-xs text-purple-700">
            Batch Master
          </div>
        )}
        {job.batch_ready && !job.batch_name && (
          <div className="text-xs text-green-700">
            Ready for Batch
          </div>
        )}
        {!job.batch_name && !job.is_batch_master && !job.batch_ready && (
          <div className="text-xs text-gray-500">
            Individual
          </div>
        )}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleMenuItemClick(() => onEdit(job))}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Job
            </DropdownMenuItem>
            
            {hasCustomWorkflow ? (
              <DropdownMenuItem onClick={handleMenuItemClick(() => onCustomWorkflow(job))}>
                <Settings className="h-4 w-4 mr-2" />
                Edit Custom Workflow
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={handleMenuItemClick(() => onCategoryAssign(job))}>
                  <Tags className="h-4 w-4 mr-2" />
                  Assign Category
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMenuItemClick(() => onCustomWorkflow(job))}>
                  <Settings className="h-4 w-4 mr-2" />
                  Custom Workflow
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuItem>
              <QrCode className="h-4 w-4 mr-2" />
              Generate QR
            </DropdownMenuItem>
            
            {/* Batch-specific actions */}
            {showBatchActions && (
              <>
                <DropdownMenuSeparator />
                
                {job.is_batch_master && onBatchSplit && (
                  <DropdownMenuItem onClick={handleMenuItemClick(() => onBatchSplit(job))}>
                    <Split className="h-4 w-4 mr-2" />
                    Split Batch
                  </DropdownMenuItem>
                )}
                
                {job.batch_name && !job.is_batch_master && onViewBatch && (
                  <DropdownMenuItem onClick={handleMenuItemClick(() => onViewBatch(job.batch_name!))}>
                    <Package2 className="h-4 w-4 mr-2" />
                    View Batch
                  </DropdownMenuItem>
                )}
              </>
            )}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleMenuItemClick(() => onDelete(job.id))}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};
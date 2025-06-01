
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
import { MoreHorizontal, Edit, Tags, QrCode, Trash2, Settings } from "lucide-react";
import { format } from "date-fns";

interface JobTableRowProps {
  job: any;
  isSelected: boolean;
  onSelect: (job: any, selected: boolean) => void;
  onEdit: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onCustomWorkflow: (job: any) => void;
  onDelete: (jobId: string) => void;
}

export const JobTableRow: React.FC<JobTableRowProps> = ({
  job,
  isSelected,
  onSelect,
  onEdit,
  onCategoryAssign,
  onCustomWorkflow,
  onDelete
}) => {
  const handleCheckboxChange = (checked: boolean) => {
    onSelect(job, checked);
  };

  const handleMenuItemClick = (action: () => void) => {
    // Prevent event bubbling and add a small delay to ensure the dropdown closes
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
    // Check if this job has a custom workflow (either flag is true or category_id is null with workflow)
    if (job.has_custom_workflow || (job.category_id === null && job.has_custom_workflow !== false)) {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Custom</Badge>;
    }
    
    // Check for category name from different possible fields
    const categoryName = job.categories?.name || job.category_name || job.category;
    
    if (categoryName) {
      return <Badge variant="outline">{categoryName}</Badge>;
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
    if (!job.current_stage) return "Not Started";
    return job.current_stage;
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="font-medium text-gray-900">{job.wo_no}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{job.customer || "N/A"}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{job.reference || "N/A"}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{job.qty || "N/A"}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getCategoryDisplay()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
          {job.status || 'Pre-Press'}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{formatDate(job.due_date)}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant="outline" className="text-xs">
          {getCurrentStage()}
        </Badge>
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
            
            {(job.has_custom_workflow || job.category_id === null) ? (
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

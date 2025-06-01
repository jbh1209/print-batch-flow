
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trash2, 
  Tag, 
  QrCode, 
  X, 
  Settings, 
  FileText,
  MoreHorizontal,
  ChevronDown
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { BulkQRCodeGenerator } from "./BulkQRCodeGenerator";

interface JobsTableBulkActionsBarProps {
  selectedJobsCount: number;
  isDeleting: boolean;
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: (status: string) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onCustomWorkflow: () => void;
  selectedJobs: any[];
}

export const JobsTableBulkActionsBar: React.FC<JobsTableBulkActionsBarProps> = ({
  selectedJobsCount,
  isDeleting,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkDelete,
  onClearSelection,
  onCustomWorkflow,
  selectedJobs
}) => {
  const [showQRGenerator, setShowQRGenerator] = useState(false);

  if (selectedJobsCount === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {selectedJobsCount} selected
            </Badge>
            <span className="text-sm text-blue-700">
              Bulk actions available
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Primary Actions */}
            <Button
              size="sm"
              onClick={() => setShowQRGenerator(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <QrCode className="h-4 w-4 mr-1" />
              Generate QR Codes
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={onBulkCategoryAssign}
            >
              <Tag className="h-4 w-4 mr-1" />
              Assign Category
            </Button>

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <MoreHorizontal className="h-4 w-4 mr-1" />
                  More
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onCustomWorkflow}>
                  <Settings className="h-4 w-4 mr-2" />
                  Custom Workflow
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => onBulkStatusUpdate('Pre-Press')}
                >
                  Set Status: Pre-Press
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onBulkStatusUpdate('Printing')}
                >
                  Set Status: Printing
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onBulkStatusUpdate('Finishing')}
                >
                  Set Status: Finishing
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onBulkStatusUpdate('Completed')}
                >
                  Set Status: Completed
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={onBulkDelete}
                  className="text-red-600"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? "Deleting..." : "Delete Jobs"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* QR Code Generator Modal */}
      <BulkQRCodeGenerator
        isOpen={showQRGenerator}
        onClose={() => setShowQRGenerator(false)}
        selectedJobs={selectedJobs}
        onComplete={() => {
          setShowQRGenerator(false);
          // Optionally refresh the jobs list here
        }}
      />
    </>
  );
};

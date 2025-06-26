
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  Tag, 
  CheckCircle, 
  QrCode,
  MoreHorizontal,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useProductionJobs } from '@/contexts/ProductionJobsContext';

interface ProductionBulkActionsBarProps {
  selectedJobsCount: number;
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: (status: string) => void;
  onBulkMarkCompleted: () => void;
  onBulkDelete: () => void;
  onGenerateBarcodes: () => void;
  isAdmin: boolean;
}

export const ProductionBulkActionsBar: React.FC<ProductionBulkActionsBarProps> = ({
  selectedJobsCount,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkMarkCompleted,
  onBulkDelete,
  onGenerateBarcodes,
  isAdmin,
}) => {
  const { clearSelection } = useProductionJobs();

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {selectedJobsCount} selected
          </Badge>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkCategoryAssign}
              className="bg-white"
            >
              <Tag className="h-4 w-4 mr-2" />
              Assign Category
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerateBarcodes}
              className="bg-white"
            >
              <QrCode className="h-4 w-4 mr-2" />
              Generate QR Labels
            </Button>
            
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkMarkCompleted}
                className="bg-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Completed
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-white">
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  More Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-white">
                <DropdownMenuItem onClick={() => onBulkStatusUpdate('Active')}>
                  Set Status: Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusUpdate('On Hold')}>
                  Set Status: On Hold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusUpdate('Pending')}>
                  Set Status: Pending
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onBulkDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4 mr-2" />
          Clear Selection
        </Button>
      </div>
    </div>
  );
};

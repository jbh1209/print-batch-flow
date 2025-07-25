
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users,
  RotateCcw,
  X,
  Workflow,
  Barcode,
  CheckCircle,
  Trash2,
  CheckSquare
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface BulkActionsBarProps {
  selectedJobs: AccessibleJob[];
  onBulkCategoryAssign: (selectedJobs: AccessibleJob[]) => void;
  onBulkStatusUpdate: (selectedJobs: AccessibleJob[], status: string) => void;
  onBulkMarkCompleted?: (selectedJobs: AccessibleJob[]) => void;
  onCustomWorkflow: (job: AccessibleJob) => void;
  onGenerateBarcodes: (selectedJobs: AccessibleJob[]) => void;
  onBulkDelete: (selectedJobs: AccessibleJob[]) => void;
  onClearSelection: () => void;
  isAdmin?: boolean;
  allVisibleJobs?: AccessibleJob[];
  searchQuery?: string;
  onSelectAllVisible?: (jobs: AccessibleJob[]) => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedJobs,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkMarkCompleted,
  onCustomWorkflow,
  onGenerateBarcodes,
  onBulkDelete,
  onClearSelection,
  isAdmin = false,
  allVisibleJobs = [],
  searchQuery = '',
  onSelectAllVisible
}) => {
  const showSelectAllSearchResults = searchQuery && allVisibleJobs.length > 0 && selectedJobs.length < allVisibleJobs.length;

  if (selectedJobs.length === 0 && !showSelectAllSearchResults) return null;

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b pb-4">
      <Card className="border-blue-200 bg-blue-50 shadow-lg">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedJobs.length > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected
                </Badge>
              )}
              
              {showSelectAllSearchResults && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {allVisibleJobs.length} job{allVisibleJobs.length > 1 ? 's' : ''} found for "{searchQuery}"
                </Badge>
              )}
              <div className="flex gap-2">
                {showSelectAllSearchResults && onSelectAllVisible && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onSelectAllVisible(allVisibleJobs)}
                    className="flex items-center gap-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  >
                    <CheckSquare className="h-3 w-3" />
                    Select All Search Results
                  </Button>
                )}
                
                {selectedJobs.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onBulkCategoryAssign(selectedJobs)}
                    className="flex items-center gap-1"
                  >
                    <Users className="h-3 w-3" />
                    Assign Category
                  </Button>
                )}
                {selectedJobs.length > 0 && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onBulkStatusUpdate(selectedJobs, "printing")}
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Update Status
                    </Button>
                    {isAdmin && onBulkMarkCompleted && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onBulkMarkCompleted(selectedJobs)}
                        className="flex items-center gap-1 border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Mark Completed
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onCustomWorkflow(selectedJobs[0])}
                      disabled={selectedJobs.length !== 1}
                      className="flex items-center gap-1"
                    >
                      <Workflow className="h-3 w-3" />
                      Custom Workflow
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onGenerateBarcodes(selectedJobs)}
                      className="flex items-center gap-1"
                    >
                      <Barcode className="h-3 w-3" />
                      Barcode Labels
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => onBulkDelete(selectedJobs)}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
            {selectedJobs.length > 0 && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={onClearSelection}
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear Selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

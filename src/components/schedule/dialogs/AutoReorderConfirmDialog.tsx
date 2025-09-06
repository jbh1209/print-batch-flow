import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Sparkles } from "lucide-react";

interface GroupPreview {
  groupName: string;
  count: number;
  jobs: string[]; // job wo_no array
}

interface AutoReorderConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  groupingType: 'paper' | 'lamination';
  groupPreviews: GroupPreview[];
  totalJobs: number;
}

export const AutoReorderConfirmDialog: React.FC<AutoReorderConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  groupingType,
  groupPreviews,
  totalJobs
}) => {
  const icon = groupingType === 'paper' ? Package : Sparkles;
  const title = groupingType === 'paper' ? 'Group by Paper Specifications' : 'Group by Lamination Type';
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {React.createElement(icon, { className: "h-5 w-5" })}
            {title}
          </DialogTitle>
          <DialogDescription>
            This will reorder {totalJobs} jobs to group them by {groupingType} specifications.
            Jobs with the same specifications will be placed together to minimize changeover time.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-60 overflow-y-auto">
          <div className="text-sm font-medium text-muted-foreground">
            Grouping Preview:
          </div>
          {groupPreviews.map((group, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-medium">
                  {group.groupName}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {group.count} job{group.count > 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Jobs: {group.jobs.join(', ')}
              </div>
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? 'Grouping...' : 'Confirm Reorder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
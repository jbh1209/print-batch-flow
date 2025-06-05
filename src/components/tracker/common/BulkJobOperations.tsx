
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  Play, 
  Pause, 
  CheckCircle, 
  Tags,
  RotateCcw,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { BulkOperationSelector, BulkOperation } from "./bulk/BulkOperationSelector";

const BULK_OPERATIONS: BulkOperation[] = [
  {
    id: 'start_jobs',
    label: 'Start Jobs',
    description: 'Start all selected jobs simultaneously',
    icon: <Play className="h-4 w-4" />,
    category: 'workflow',
    requiresConfirmation: true
  },
  {
    id: 'complete_jobs',
    label: 'Complete Jobs',
    description: 'Mark all selected jobs as complete',
    icon: <CheckCircle className="h-4 w-4" />,
    category: 'workflow',
    requiresConfirmation: true
  },
  {
    id: 'hold_jobs',
    label: 'Hold Jobs',
    description: 'Put all selected jobs on hold',
    icon: <Pause className="h-4 w-4" />,
    category: 'workflow',
    requiresConfirmation: true
  },
  {
    id: 'update_status',
    label: 'Update Status',
    description: 'Change status for all selected jobs',
    icon: <RotateCcw className="h-4 w-4" />,
    category: 'management',
    requiresConfirmation: true
  },
  {
    id: 'assign_category',
    label: 'Assign Category',
    description: 'Assign category to selected jobs',
    icon: <Tags className="h-4 w-4" />,
    category: 'organization',
    requiresConfirmation: false
  }
];

interface BulkJobOperationsProps {
  selectedJobs: AccessibleJob[];
  onBulkStart?: (jobIds: string[]) => Promise<boolean>;
  onBulkComplete?: (jobIds: string[]) => Promise<boolean>;
  onBulkHold?: (jobIds: string[], reason: string, notes?: string) => Promise<boolean>;
  onBulkStatusUpdate?: (jobIds: string[], status: string) => Promise<boolean>;
  onBulkCategoryAssign?: (jobIds: string[], categoryId: string) => Promise<boolean>;
  onClearSelection?: () => void;
  className?: string;
}

export const BulkJobOperations: React.FC<BulkJobOperationsProps> = ({
  selectedJobs,
  onBulkStart,
  onBulkComplete,
  onBulkHold,
  onBulkStatusUpdate,
  onBulkCategoryAssign,
  onClearSelection,
  className
}) => {
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [operationNotes, setOperationNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (selectedJobs.length === 0) {
    return null;
  }

  const handleOperationToggle = (operationId: string, checked: boolean) => {
    if (checked) {
      setSelectedOperations(prev => [...prev, operationId]);
    } else {
      setSelectedOperations(prev => prev.filter(id => id !== operationId));
    }
  };

  const executeOperations = async () => {
    if (selectedOperations.length === 0) return;

    setIsProcessing(true);
    try {
      const jobIds = selectedJobs.map(job => job.job_id);

      for (const operationId of selectedOperations) {
        switch (operationId) {
          case 'start_jobs':
            if (onBulkStart) {
              await onBulkStart(jobIds);
            }
            break;
          case 'complete_jobs':
            if (onBulkComplete) {
              await onBulkComplete(jobIds);
            }
            break;
          case 'hold_jobs':
            if (onBulkHold) {
              await onBulkHold(jobIds, 'bulk_operation', operationNotes);
            }
            break;
          case 'update_status':
            if (onBulkStatusUpdate) {
              await onBulkStatusUpdate(jobIds, 'updated');
            }
            break;
          case 'assign_category':
            if (onBulkCategoryAssign) {
              console.log('Category assignment would need category selector');
            }
            break;
        }
      }

      setSelectedOperations([]);
      setOperationNotes("");
      setShowConfirmation(false);
      onClearSelection?.();
    } catch (error) {
      console.error("Bulk operation failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const requiresConfirmation = selectedOperations.some(id => 
    BULK_OPERATIONS.find(op => op.id === id)?.requiresConfirmation
  );

  return (
    <Card className={cn("w-full border-blue-200 bg-blue-50", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Bulk Operations
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selected Jobs Summary */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selected Jobs</Label>
          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
            {selectedJobs.slice(0, 10).map((job) => (
              <Badge key={job.job_id} variant="outline" className="text-xs">
                {job.wo_no}
              </Badge>
            ))}
            {selectedJobs.length > 10 && (
              <Badge variant="secondary" className="text-xs">
                +{selectedJobs.length - 10} more
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        <BulkOperationSelector
          operations={BULK_OPERATIONS}
          selectedOperations={selectedOperations}
          onOperationToggle={handleOperationToggle}
        />

        {/* Operation Notes */}
        {selectedOperations.length > 0 && (
          <div className="space-y-3">
            <Label htmlFor="operation-notes">Operation Notes (Optional)</Label>
            <Textarea
              id="operation-notes"
              placeholder="Add notes about this bulk operation..."
              value={operationNotes}
              onChange={(e) => setOperationNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button 
            onClick={onClearSelection}
            variant="outline"
            className="flex-1"
          >
            Clear Selection
          </Button>
          <Button 
            onClick={requiresConfirmation ? () => setShowConfirmation(true) : executeOperations}
            disabled={selectedOperations.length === 0 || isProcessing}
            className="flex-2 bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? 'Processing...' : `Execute ${selectedOperations.length} Operation${selectedOperations.length > 1 ? 's' : ''}`}
          </Button>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-orange-800">Confirm Bulk Operations</span>
            </div>
            <p className="text-sm text-orange-700">
              You are about to perform {selectedOperations.length} operation(s) on {selectedJobs.length} job(s). 
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowConfirmation(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button 
                onClick={executeOperations}
                variant="destructive"
                size="sm"
              >
                Confirm & Execute
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

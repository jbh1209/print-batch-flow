import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  PlayCircle, 
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Scan,
  Timer
} from "lucide-react";
import { JobSelection } from "@/hooks/tracker/useConcurrentJobManagement";

interface BatchStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJobs: JobSelection[];
  onStartBatch: (options: {
    requireBarcodes: boolean;
    notes?: string;
    supervisorOverride?: {
      supervisorId: string;
      reason: string;
    };
  }) => void;
  isProcessing?: boolean;
  batchCompatibility: {
    compatible: boolean;
    issues: string[];
  };
}

export const BatchStartModal: React.FC<BatchStartModalProps> = ({
  isOpen,
  onClose,
  selectedJobs,
  onStartBatch,
  isProcessing = false,
  batchCompatibility
}) => {
  const [requireBarcodes, setRequireBarcodes] = useState(true);
  const [notes, setNotes] = useState("");
  const [needsSupervisorOverride, setNeedsSupervisorOverride] = useState(false);
  const [supervisorReason, setSupervisorReason] = useState("");

  // Check if supervisor override is needed
  useEffect(() => {
    const hasIncompatibleJobs = selectedJobs.some(job => !job.isCompatible);
    const hasCrossDepartment = new Set(selectedJobs.map(j => j.departmentName)).size > 1;
    setNeedsSupervisorOverride(hasIncompatibleJobs || hasCrossDepartment || !batchCompatibility.compatible);
  }, [selectedJobs, batchCompatibility]);

  const handleStartBatch = () => {
    const options: any = {
      requireBarcodes,
      notes: notes.trim() || undefined
    };

    if (needsSupervisorOverride) {
      if (!supervisorReason.trim()) {
        return; // Validation handled by disabled state
      }
      options.supervisorOverride = {
        supervisorId: 'current-user', // Would be actual supervisor ID
        reason: supervisorReason.trim()
      };
    }

    onStartBatch(options);
    handleClose();
  };

  const handleClose = () => {
    setNotes("");
    setSupervisorReason("");
    setRequireBarcodes(true);
    onClose();
  };

  const estimatedTotalTime = selectedJobs.reduce((total, job) => {
    // Get estimated duration from job data (would need to be passed in)
    return total + 60; // Default 60 minutes per job
  }, 0);

  const departmentGroups = selectedJobs.reduce((groups, job) => {
    const dept = job.departmentName || 'Unknown';
    if (!groups[dept]) groups[dept] = [];
    groups[dept].push(job);
    return groups;
  }, {} as Record<string, JobSelection[]>);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-600" />
            Start Batch of {selectedJobs.length} Jobs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Batch Overview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-blue-900">Batch Overview</h4>
              <Badge variant="default" className="bg-blue-600">
                {selectedJobs.length} Jobs
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-blue-600" />
                <span>Est. {Math.round(estimatedTotalTime / 60)}h {estimatedTotalTime % 60}m</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span>{Object.keys(departmentGroups).length} Department(s)</span>
              </div>
            </div>
          </div>

          {/* Department Groups */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Jobs by Department</Label>
            {Object.entries(departmentGroups).map(([department, jobs]) => (
              <div key={department} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-sm">{department}</h5>
                  <Badge variant="outline">{jobs.length} jobs</Badge>
                </div>
                <div className="space-y-1">
                  {jobs.map(job => (
                    <div key={job.stageId} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{job.woNo}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">{job.customer}</span>
                        {job.isCompatible ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Compatibility Issues */}
          {!batchCompatibility.compatible && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                Compatibility Issues
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {batchCompatibility.issues.map((issue, index) => (
                  <li key={index}>• {issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requireBarcodes"
                checked={requireBarcodes}
                onCheckedChange={(checked) => setRequireBarcodes(checked === true)}
              />
              <Label htmlFor="requireBarcodes" className="text-sm cursor-pointer">
                <div className="flex items-center gap-2">
                  <Scan className="h-4 w-4" />
                  Require barcode scan for each job
                </div>
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Batch Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this batch start..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            {/* Supervisor Override Section */}
            {needsSupervisorOverride && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Supervisor Override Required
                </div>
                <p className="text-sm text-amber-700">
                  This batch has compatibility issues or crosses department boundaries. 
                  Supervisor authorization is required to proceed.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="supervisorReason" className="text-sm font-medium">
                    Override Reason *
                  </Label>
                  <Textarea
                    id="supervisorReason"
                    placeholder="Explain why this batch override is necessary..."
                    value={supervisorReason}
                    onChange={(e) => setSupervisorReason(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Workflow Preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h5 className="font-medium text-sm mb-2">Batch Start Process</h5>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                All {selectedJobs.length} jobs will be marked as "Active"
              </div>
              {requireBarcodes && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Each job will require barcode verification
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Batch start will be logged for audit trail
              </div>
              {needsSupervisorOverride && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  Supervisor override will be recorded
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleStartBatch}
            disabled={
              isProcessing || 
              (needsSupervisorOverride && !supervisorReason.trim())
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? "Starting..." : (
              requireBarcodes ? "Start with Barcodes" : "Start Batch"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
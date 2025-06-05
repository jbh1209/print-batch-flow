
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  AlertTriangle, 
  Pause, 
  Play, 
  Clock,
  MessageSquare,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobHoldManagerProps {
  job: AccessibleJob;
  onHoldJob?: (jobId: string, reason: string, notes?: string) => Promise<boolean>;
  onReleaseJob?: (jobId: string, notes?: string) => Promise<boolean>;
  className?: string;
}

interface HoldReason {
  id: string;
  label: string;
  description: string;
  category: 'material' | 'equipment' | 'quality' | 'approval' | 'scheduling' | 'other';
}

const HOLD_REASONS: HoldReason[] = [
  {
    id: 'material_shortage',
    label: 'Material Shortage',
    description: 'Required materials are not available',
    category: 'material'
  },
  {
    id: 'material_defect',
    label: 'Material Defect',
    description: 'Materials have quality issues',
    category: 'material'
  },
  {
    id: 'equipment_malfunction',
    label: 'Equipment Malfunction',
    description: 'Machine or equipment failure',
    category: 'equipment'
  },
  {
    id: 'equipment_maintenance',
    label: 'Equipment Maintenance',
    description: 'Scheduled or unscheduled maintenance',
    category: 'equipment'
  },
  {
    id: 'quality_check',
    label: 'Quality Check Required',
    description: 'Waiting for quality inspection',
    category: 'quality'
  },
  {
    id: 'quality_rework',
    label: 'Quality Rework',
    description: 'Rework required due to quality issues',
    category: 'quality'
  },
  {
    id: 'customer_approval',
    label: 'Customer Approval',
    description: 'Waiting for customer sign-off',
    category: 'approval'
  },
  {
    id: 'supervisor_approval',
    label: 'Supervisor Approval',
    description: 'Requires supervisor authorization',
    category: 'approval'
  },
  {
    id: 'scheduling_conflict',
    label: 'Scheduling Conflict',
    description: 'Resource scheduling conflict',
    category: 'scheduling'
  },
  {
    id: 'break_lunch',
    label: 'Break/Lunch',
    description: 'Temporary hold for break',
    category: 'scheduling'
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Other reason (specify in notes)',
    category: 'other'
  }
];

export const JobHoldManager: React.FC<JobHoldManagerProps> = ({
  job,
  onHoldJob,
  onReleaseJob,
  className
}) => {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [holdNotes, setHoldNotes] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock job hold status - in real implementation, this would come from job data
  const isJobOnHold = job.current_stage_status === 'hold' || false;
  const currentHoldReason = "material_shortage"; // Mock data
  const holdStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // Mock: 2 hours ago

  const getReasonsByCategory = () => {
    const categories = ['material', 'equipment', 'quality', 'approval', 'scheduling', 'other'];
    return categories.reduce((acc, category) => {
      acc[category] = HOLD_REASONS.filter(reason => reason.category === category);
      return acc;
    }, {} as Record<string, HoldReason[]>);
  };

  const getReasonLabel = (reasonId: string) => {
    return HOLD_REASONS.find(reason => reason.id === reasonId)?.label || reasonId;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      material: 'bg-red-100 text-red-800',
      equipment: 'bg-orange-100 text-orange-800', 
      quality: 'bg-yellow-100 text-yellow-800',
      approval: 'bg-blue-100 text-blue-800',
      scheduling: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const handleHoldJob = async () => {
    if (!selectedReason || !onHoldJob) return;

    setIsProcessing(true);
    try {
      const success = await onHoldJob(job.job_id, selectedReason, holdNotes);
      if (success) {
        setSelectedReason("");
        setHoldNotes("");
      }
    } catch (error) {
      console.error("Failed to hold job:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReleaseJob = async () => {
    if (!onReleaseJob) return;

    setIsProcessing(true);
    try {
      const success = await onReleaseJob(job.job_id, releaseNotes);
      if (success) {
        setReleaseNotes("");
      }
    } catch (error) {
      console.error("Failed to release job:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const reasonsByCategory = getReasonsByCategory();

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isJobOnHold ? (
            <>
              <Pause className="h-5 w-5 text-orange-500" />
              Job On Hold
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5" />
              Hold Management
            </>
          )}
          <Badge variant="outline" className="ml-auto">
            {job.wo_no}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isJobOnHold ? (
          /* Job is currently on hold - show release options */
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Pause className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-orange-800">Currently On Hold</span>
                </div>
                <p className="text-sm text-orange-700">
                  Reason: {getReasonLabel(currentHoldReason)}
                </p>
                <div className="flex items-center gap-2 text-xs text-orange-600">
                  <Clock className="h-3 w-3" />
                  <span>Since: {holdStartTime.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="release-notes">Release Notes (Optional)</Label>
              <Textarea
                id="release-notes"
                placeholder="Add notes about resolving the hold..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <Button 
              onClick={handleReleaseJob}
              disabled={isProcessing}
              className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? 'Releasing...' : 'Release Job'}
            </Button>
          </div>
        ) : (
          /* Job is not on hold - show hold options */
          <div className="space-y-6">
            <div className="space-y-4">
              <Label>Select Hold Reason</Label>
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                {Object.entries(reasonsByCategory).map(([category, reasons]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getCategoryColor(category)} variant="secondary">
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Badge>
                    </div>
                    <div className="ml-4 space-y-2">
                      {reasons.map((reason) => (
                        <div key={reason.id} className="flex items-start space-x-2">
                          <RadioGroupItem value={reason.id} id={reason.id} className="mt-0.5" />
                          <div className="flex-1">
                            <Label 
                              htmlFor={reason.id} 
                              className="text-sm font-medium cursor-pointer"
                            >
                              {reason.label}
                            </Label>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {reason.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label htmlFor="hold-notes">
                Additional Notes 
                {selectedReason === 'other' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="hold-notes"
                placeholder={
                  selectedReason === 'other' 
                    ? "Please specify the reason for holding this job..."
                    : "Add any additional details about the hold..."
                }
                value={holdNotes}
                onChange={(e) => setHoldNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <Button 
              onClick={handleHoldJob}
              disabled={!selectedReason || (selectedReason === 'other' && !holdNotes.trim()) || isProcessing}
              variant="destructive"
              className="w-full flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              {isProcessing ? 'Holding...' : 'Hold Job'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

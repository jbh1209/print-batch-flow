
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Clock, Play } from "lucide-react";

interface ProductionJob {
  id: string;
  wo_no: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  sla_target_days?: number;
}

interface WorkflowInitModalProps {
  job: ProductionJob;
  categories: Category[];
  onClose: () => void;
  onInitialize: (job: ProductionJob, categoryId: string) => void;
  isProcessing?: boolean;
}

export const WorkflowInitModal: React.FC<WorkflowInitModalProps> = ({
  job,
  categories,
  onClose,
  onInitialize,
  isProcessing = false
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const handleInitialize = () => {
    if (!selectedCategoryId) return;
    onInitialize(job, selectedCategoryId);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-600" />
            Initialize Workflow
          </DialogTitle>
          <DialogDescription>
            Select a category to initialize the workflow for job {job.wo_no}. This will create all the necessary production stages and start tracking progress.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="text-base font-medium">Select Category</Label>
          <RadioGroup 
            value={selectedCategoryId} 
            onValueChange={setSelectedCategoryId}
            className="mt-3 space-y-3"
          >
            {categories.map((category) => (
              <div key={category.id} className="border rounded-lg p-3 hover:bg-gray-50">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value={category.id} id={category.id} className="mt-1" />
                  <div className="flex-1">
                    <Label 
                      htmlFor={category.id} 
                      className="flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </Label>
                    {category.description && (
                      <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        SLA: {category.sla_target_days || 3} days
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>

          {selectedCategoryId && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">What happens next:</p>
                  <ul className="text-sm text-blue-700 mt-1 space-y-1">
                    <li>• Job will be assigned to the selected category</li>
                    <li>• All production stages will be created for this job</li>
                    <li>• First stage will be activated automatically</li>
                    <li>• Job will appear in the workflow kanban boards</li>
                    <li>• Progress tracking and QR codes will be enabled</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleInitialize} 
            disabled={isProcessing || !selectedCategoryId}
          >
            {isProcessing ? "Initializing..." : "Initialize Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

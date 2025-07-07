import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { useCategories } from "@/hooks/tracker/useCategories";
import { useCategoryParts } from "@/hooks/tracker/useCategoryParts";
import { useAtomicCategoryAssignment } from "@/hooks/tracker/useAtomicCategoryAssignment.tsx";
import { supabase } from "@/integrations/supabase/client";

interface SimpleCategoryAssignModalProps {
  job: any;
  onClose: () => void;
  onAssign: () => void;
}

interface CategoryWithStages {
  id: string;
  name: string;
  color: string;
  sla_target_days: number;
  description?: string;
  requires_part_assignment: boolean;
  hasStages: boolean;
  stageCount: number;
}

export const SimpleCategoryAssignModal: React.FC<SimpleCategoryAssignModalProps> = ({
  job,
  onClose,
  onAssign
}) => {
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { assignCategoryWithWorkflow, isAssigning } = useAtomicCategoryAssignment();
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [categoriesWithStages, setCategoriesWithStages] = useState<CategoryWithStages[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const [currentStep, setCurrentStep] = useState<'category' | 'parts'>('category');
  const [partAssignments, setPartAssignments] = useState<Record<string, string>>({});

  const { availableParts, multiPartStages, hasMultiPartStages, isLoading: partsLoading } = useCategoryParts(selectedCategoryId);

  const jobInitialCategoryId = useMemo(() => job?.category_id, [job]);
  const jobInitialCategoryName = useMemo(() => {
    if (!jobInitialCategoryId || !categoriesWithStages.length) return null;
    return categoriesWithStages.find(c => c.id === jobInitialCategoryId)?.name || 'Unknown Category';
  }, [jobInitialCategoryId, categoriesWithStages]);

  // Initialize selectedCategoryId with job's current category or if job has stages defined (for repair)
  useEffect(() => {
    if (job?.category_id) {
      setSelectedCategoryId(job.category_id);
    } else {
      setSelectedCategoryId(""); // Reset if job has no category
    }
  }, [job]);

  // Load category stage information
  useEffect(() => {
    const loadCategoriesWithStages = async () => {
      if (!categories.length) {
        setLoadingStages(false); // Ensure loading stops if no categories
        return;
      }

      setLoadingStages(true);
      try {
        const categoriesWithStageInfo = await Promise.all(
          categories.map(async (category) => {
            const { data: stages, error } = await supabase
              .from('category_production_stages')
              .select('id', { count: 'exact' }) // Request count
              .eq('category_id', category.id);

            if (error) {
              console.error('Error loading stages for category:', category.id, error);
              return {
                ...category,
                hasStages: false,
                stageCount: 0
              };
            }
            const count = stages?.length || 0; // Supabase count might be in a different property depending on version/query
            return {
              ...category,
              hasStages: count > 0,
              stageCount: count
            };
          })
        );
        setCategoriesWithStages(categoriesWithStageInfo);
      } catch (error) {
        console.error('Error loading category stage information:', error);
      } finally {
        setLoadingStages(false);
      }
    };

    loadCategoriesWithStages();
  }, [categories]);

  const selectedCategoryDetails = categoriesWithStages.find(cat => cat.id === selectedCategoryId);
  const jobIds = job.isMultiple ? job.selectedIds : [job.id];

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setPartAssignments({}); // Reset part assignments when category changes
    setCurrentStep('category'); // Always go back to category step if category changes
  };

  const handleNextStep = () => {
    if (!selectedCategoryId || !selectedCategoryDetails) return;

    // Check if this category requires part assignment
    if (selectedCategoryDetails.hasStages && selectedCategoryDetails.requires_part_assignment && availableParts.length > 0) {
      setCurrentStep('parts');
    } else {
      handleAssignment();
    }
  };

  const handleAssignment = async () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category.");
      return;
    }
    if (!selectedCategoryDetails?.hasStages) {
        toast.error(`Category "${selectedCategoryDetails?.name || 'Unknown'}" has no stages and cannot be assigned.`);
        return;
    }

    let finalPartAssignments: Record<string, string> | undefined = undefined;

    // Only require part assignments if the category specifically requires them
    if (selectedCategoryDetails.requires_part_assignment && hasMultiPartStages) {
      const unassignedParts = availableParts.filter(part => !partAssignments[part]);
      if (unassignedParts.length > 0) {
        toast.error(`Please assign all parts to a stage: ${unassignedParts.join(', ')}`);
        return;
      }
      finalPartAssignments = partAssignments;
    }

    console.log('🚀 Calling assignCategoryWithWorkflow with:', {
      jobIds,
      selectedCategoryId,
      finalPartAssignments,
      jobInitialCategoryId,
    });

    const success = await assignCategoryWithWorkflow(
      jobIds,
      selectedCategoryId,
      finalPartAssignments,
      job.isMultiple ? null : jobInitialCategoryId
    );

    if (success) {
      onAssign();
      onClose();
    }
  };

  const handlePartAssignmentsChange = (assignments: Record<string, string>) => {
    console.log('🔄 Part assignments changed:', assignments);
    setPartAssignments(assignments);
  };
  
  const isRepairScenario = jobInitialCategoryId && selectedCategoryId === jobInitialCategoryId && job.stagesMissing; // Assuming job.stagesMissing prop exists
  const isChangingCategory = jobInitialCategoryId && selectedCategoryId !== jobInitialCategoryId;
  const isNewAssignment = !jobInitialCategoryId;

  let actionButtonText = "Assign Category";
  if (isRepairScenario) {
    actionButtonText = "Repair Workflow";
  } else if (isChangingCategory) {
    actionButtonText = "Change Category";
  }
  
  if (currentStep === 'category' && selectedCategoryDetails?.requires_part_assignment && availableParts.length > 0 && selectedCategoryDetails?.hasStages) {
     actionButtonText = "Next: Assign Parts";
  } else if (currentStep === 'parts') {
    actionButtonText = "Complete Assignment";
  }


  const canProceedToPartsOrAssign = selectedCategoryId && selectedCategoryDetails?.hasStages;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'category' ? 
              (jobInitialCategoryId ? 'Change or Repair Category' : 'Assign Category') : 
              'Assign Parts to Stages'}
            {job.isMultiple ? ` (${jobIds.length} jobs)` : ` - Job: ${job.wo_no || 'Unknown'}`}
          </DialogTitle>
          {jobInitialCategoryName && currentStep === 'category' && (
            <DialogDescription>
              Currently assigned: <Badge variant="outline">{jobInitialCategoryName}</Badge>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {currentStep === 'category' && (
            <>
              {/* Category Selection */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="category-select" className="text-sm font-medium mb-2 block">
                    Select Category
                  </label>
                  
                  {categoriesLoading || loadingStages ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Loading categories...</span>
                    </div>
                  ) : (
                    <Select value={selectedCategoryId} onValueChange={handleCategorySelect}>
                      <SelectTrigger id="category-select">
                        <SelectValue placeholder="Choose a category..." />
                      </SelectTrigger>
                      <SelectContent
                        side="top"
                        collisionPadding={16}
                        avoidCollisions={true}
                        className="max-h-[48vh] overflow-y-auto z-[1200] bg-white"
                        align="start"
                      >
                        {categoriesWithStages.map((category) => (
                          <SelectItem 
                            key={category.id} 
                            value={category.id}
                            disabled={!category.hasStages && category.id !== jobInitialCategoryId} // Allow selecting current if it has no stages (for visibility)
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: category.color || '#6B7280' }}
                                />
                                <span>{category.name}</span>
                                <span className="text-xs text-gray-500">
                                  ({category.sla_target_days || 0} days SLA)
                                </span>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                {category.hasStages ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                    <span className="text-xs text-green-600">
                                      {category.stageCount} stage{category.stageCount !== 1 ? 's' : ''}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                    <span className="text-xs text-red-600">No stages</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                         {categoriesWithStages.length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-500">
                                No categories available or none have stages.
                            </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Category Info */}
                {selectedCategoryDetails && (
                  <div className={`p-4 rounded-lg ${selectedCategoryDetails.hasStages ? 'bg-gray-50' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: selectedCategoryDetails.color }}
                      />
                      <h4 className="font-medium">{selectedCategoryDetails.name}</h4>
                      {selectedCategoryDetails.hasStages ? (
                        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {selectedCategoryDetails.stageCount} stage{selectedCategoryDetails.stageCount !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          No stages configured
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>SLA Target:</strong> {selectedCategoryDetails.sla_target_days} days</p>
                      {selectedCategoryDetails.description && (
                        <p><strong>Description:</strong> {selectedCategoryDetails.description}</p>
                      )}
                      {!selectedCategoryDetails.hasStages && (
                        <p className="text-red-600 font-medium">
                          ⚠️ This category cannot be assigned because it has no production stages configured.
                          Please contact an administrator to set up the workflow stages for this category.
                        </p>
                      )}
                      {selectedCategoryDetails.hasStages && selectedCategoryDetails.requires_part_assignment && availableParts.length > 0 && (
                         <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 flex items-start">
                            <InfoIcon className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                            <span>This category requires part assignment. You will be prompted to assign parts to specific stages in the next step.</span>
                        </div>
                      )}
                      {jobInitialCategoryId && selectedCategoryId === jobInitialCategoryId && job.stagesMissing && ( // Example condition
                        <p className="text-orange-600 font-medium mt-2">
                          ℹ️ This job's workflow stages seem to be missing. Re-assigning this category will attempt to repair and initialize them.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                 {!selectedCategoryId && jobInitialCategoryId && jobInitialCategoryName && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
                        This job is currently assigned to "<strong>{jobInitialCategoryName}</strong>". Select a new category to change it, or re-select "<strong>{jobInitialCategoryName}</strong>" if you need to re-initialize its workflow.
                    </div>
                )}
              </div>
            </>
          )}

          {currentStep === 'parts' && selectedCategoryDetails && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Part Assignment Required</h4>
                <p className="text-sm text-blue-700">
                  The selected category "{selectedCategoryDetails.name}" requires part assignment. 
                  Please assign each part to the appropriate production stage.
                </p>
              </div>

              {partsLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading part assignments...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableParts.map((part) => (
                    <div key={part} className="space-y-2">
                      <label htmlFor={`part-assign-${part}`} className="text-sm font-medium">
                        Assign "{part}" to stage:
                      </label>
                      <Select
                        value={partAssignments[part] || ""}
                        onValueChange={(value) => {
                          const newAssignments = { ...partAssignments };
                          if (value) {
                            newAssignments[part] = value;
                          } else {
                            delete newAssignments[part];
                          }
                          handlePartAssignmentsChange(newAssignments);
                        }}
                      >
                        <SelectTrigger id={`part-assign-${part}`}>
                          <SelectValue placeholder="Select a stage..." />
                        </SelectTrigger>
                        <SelectContent
                          side="top"
                          collisionPadding={16}
                          avoidCollisions={true}
                          className="max-h-[48vh] overflow-y-auto z-[1200] bg-white"
                          align="start"
                        >
                          {multiPartStages
                            .filter(stage => stage.part_types.includes(part))
                            .map((stage) => (
                              <SelectItem key={stage.stage_id} value={stage.stage_id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: stage.stage_color || '#6B7280' }}
                                  />
                                  <span>{stage.stage_name}</span>
                                </div>
                              </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            {currentStep === 'parts' && (
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('category')} 
                disabled={isAssigning}
              >
                Back
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            {currentStep === 'category' && (
              <Button 
                onClick={handleNextStep} 
                disabled={!canProceedToPartsOrAssign || isAssigning }
              >
                {isAssigning ? (
                    <> <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing... </>
                ) : (
                    actionButtonText
                )}
              </Button>
            )}
            {currentStep === 'parts' && (
              <Button onClick={handleAssignment} disabled={isAssigning || Object.keys(partAssignments).length < availableParts.length}>
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Assigning...
                  </>
                ) : (
                  actionButtonText
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

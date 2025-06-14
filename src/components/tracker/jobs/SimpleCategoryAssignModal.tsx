
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCategories } from "@/hooks/tracker/useCategories";
import { useCategoryParts } from "@/hooks/tracker/useCategoryParts";
import { useAtomicCategoryAssignment } from "@/hooks/tracker/useAtomicCategoryAssignment";
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

  // Load category stage information
  useEffect(() => {
    const loadCategoriesWithStages = async () => {
      if (!categories.length) return;

      setLoadingStages(true);
      try {
        const categoriesWithStageInfo = await Promise.all(
          categories.map(async (category) => {
            const { data: stages, error } = await supabase
              .from('category_production_stages')
              .select('id')
              .eq('category_id', category.id);

            if (error) {
              console.error('Error loading stages for category:', category.id, error);
              return {
                ...category,
                hasStages: false,
                stageCount: 0
              };
            }

            return {
              ...category,
              hasStages: stages && stages.length > 0,
              stageCount: stages?.length || 0
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

  const selectedCategory = categoriesWithStages.find(cat => cat.id === selectedCategoryId);
  const jobIds = job.isMultiple ? job.selectedIds : [job.id];

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setPartAssignments({});
    setCurrentStep('category');
  };

  const handleNextStep = () => {
    if (!selectedCategoryId) return;

    if (hasMultiPartStages && availableParts.length > 0) {
      setCurrentStep('parts');
    } else {
      handleAssignment();
    }
  };

  const handleAssignment = async () => {
    if (!selectedCategoryId) return;

    console.log('🚀 Starting assignment process:', {
      jobIds,
      selectedCategoryId,
      hasMultiPartStages,
      partAssignments,
      availableParts
    });

    // Enhanced part assignment validation and exact name mapping
    let finalPartAssignments: Record<string, string> | undefined = undefined;

    if (hasMultiPartStages && Object.keys(partAssignments).length > 0) {
      console.log('📋 Processing multi-part assignments:', partAssignments);
      
      // Validate all parts are assigned
      const unassignedParts = availableParts.filter(part => !partAssignments[part]);
      if (unassignedParts.length > 0) {
        toast.error(`Please assign all parts: ${unassignedParts.join(', ')}`);
        return;
      }

      // CRITICAL FIX: Map UI part names to exact stage IDs
      finalPartAssignments = {};
      
      // Validate each assignment and map to exact stage ID
      for (const [partName, stageId] of Object.entries(partAssignments)) {
        // Find the exact stage that matches this assignment
        const assignedStage = multiPartStages.find(stage => stage.stage_id === stageId);
        
        if (!assignedStage) {
          console.error('❌ Invalid stage assignment:', { partName, stageId, availableStages: multiPartStages });
          toast.error(`Invalid stage assignment for part: ${partName}`);
          return;
        }

        // Verify the part is actually supported by this stage
        if (!assignedStage.part_types.includes(partName)) {
          console.error('❌ Part not supported by stage:', { 
            partName, 
            stageId, 
            stageName: assignedStage.stage_name,
            supportedParts: assignedStage.part_types 
          });
          toast.error(`Part "${partName}" is not supported by stage "${assignedStage.stage_name}"`);
          return;
        }

        // Use exact part name as stored in part_definitions
        finalPartAssignments[partName] = stageId;
      }
      
      console.log('✅ Final validated part assignments:', finalPartAssignments);
    }

    const success = await assignCategoryWithWorkflow(
      jobIds,
      selectedCategoryId,
      finalPartAssignments
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

  const canProceed = selectedCategoryId && selectedCategory?.hasStages;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'category' ? 'Assign Category' : 'Assign Parts to Stages'}
            {job.isMultiple ? ` (${jobIds.length} jobs)` : ` - ${job.wo_no || 'Unknown'}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {currentStep === 'category' && (
            <>
              {/* Category Selection */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select Category
                  </label>
                  
                  {categoriesLoading || loadingStages ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Loading categories...</span>
                    </div>
                  ) : (
                    <Select value={selectedCategoryId} onValueChange={handleCategorySelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesWithStages.map((category) => (
                          <SelectItem 
                            key={category.id} 
                            value={category.id}
                            disabled={!category.hasStages}
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
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Category Info */}
                {selectedCategory && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                      <h4 className="font-medium">{selectedCategory.name}</h4>
                      {selectedCategory.hasStages ? (
                        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {selectedCategory.stageCount} stage{selectedCategory.stageCount !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          No stages configured
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>SLA Target:</strong> {selectedCategory.sla_target_days} days</p>
                      {selectedCategory.description && (
                        <p><strong>Description:</strong> {selectedCategory.description}</p>
                      )}
                      {!selectedCategory.hasStages && (
                        <p className="text-red-600 font-medium">
                          ⚠️ This category cannot be assigned because it has no production stages configured.
                          Please contact an administrator to set up the workflow stages for this category.
                        </p>
                      )}
                      {hasMultiPartStages && availableParts.length > 0 && (
                        <p className="text-blue-600">
                          📋 This category has multi-part stages that will require part assignments.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {currentStep === 'parts' && selectedCategory && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Part Assignment Required</h4>
                <p className="text-sm text-blue-700">
                  The selected category "{selectedCategory.name}" has multi-part stages. 
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
                      <label className="text-sm font-medium">
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select a stage..." />
                        </SelectTrigger>
                        <SelectContent>
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
                disabled={!canProceed || isAssigning}
              >
                {hasMultiPartStages && availableParts.length > 0 ? "Next: Assign Parts" : "Assign Category"}
              </Button>
            )}
            {currentStep === 'parts' && (
              <Button onClick={handleAssignment} disabled={isAssigning}>
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Assigning...
                  </>
                ) : (
                  "Complete Assignment"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedJobCreationResult } from "@/utils/excel/enhancedJobCreator";
import { useToast } from "@/hooks/use-toast";

interface EnhancedJobCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: EnhancedJobCreationResult | null;
  onConfirm: (userApprovedMappings: Array<{
    groupName: string;
    mappedStageId: string;
    mappedStageName: string;
    category: string;
  }>) => Promise<void>;
  isLoading?: boolean;
  finalResult?: EnhancedJobCreationResult | null;
}

interface RowMappingResult {
  excelRowIndex: number;
  excelData: any[];
  groupName: string;
  description: string;
  qty: number;
  woQty: number;
  mappedStageId: string | null;
  mappedStageName: string | null;
  mappedStageSpecId: string | null;
  mappedStageSpecName: string | null;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'paper' | 'unknown';
  manualOverride?: boolean;
  isUnmapped: boolean;
  instanceId?: string;
  paperSpecification?: string;
  partType?: string;
}

export const EnhancedJobCreationDialog: React.FC<EnhancedJobCreationDialogProps> = ({
  isOpen,
  onClose,
  result,
  onConfirm,
  isLoading = false,
  finalResult
}) => {
  const { toast } = useToast();
  const [updatedRowMappings, setUpdatedRowMappings] = useState<{ [woNo: string]: any[] }>({});
  const [approvedMappings, setApprovedMappings] = useState<any[]>([]);
  const [filteredMappings, setFilteredMappings] = useState<any[]>([]);

  useEffect(() => {
    if (result?.rowMappings) {
      // Initialize updatedRowMappings with current result data from the correct location
      const initialMappings: { [woNo: string]: any[] } = {};
      Object.entries(result.rowMappings).forEach(([woNo, mappings]) => {
        if (mappings && mappings.length > 0) {
          initialMappings[woNo] = [...mappings];
        }
      });
      setUpdatedRowMappings(initialMappings);
      console.log('Initialized row mappings:', initialMappings);
    }
  }, [result]);

  // Calculate statistics from the result
  const stats = result ? {
    totalJobs: result.jobs?.length || 0,
    totalMappings: Object.values(result.rowMappings || {}).flat().length,
    categoriesDetected: Object.keys(result.categoryAssignments || {}).length,
    requiresApproval: Object.values(result.rowMappings || {}).flat().some(m => !m.mappedStageId)
  } : null;

  const handlePreview = async () => {
    if (!result) return;

    try {
      const allMappings = Object.values(result.rowMappings || {}).flat();
      
      if (allMappings.length === 0) {
        toast({
          title: "No mappings found",
          description: "No stage mappings were detected in the uploaded file.",
          variant: "destructive"
        });
        return;
      }

      // Enhanced stage mapping preview with matrix support
      try {
        // For standard uploads, check if we have custom workflow requirements
        const approved = Object.values(result.rowMappings).flat();
        setApprovedMappings(approved);
        setFilteredMappings(approved);
        
        console.log('📋 Enhanced Preview - Row mappings summary:', {
          totalMappings: approved.length,
          mappingsWithStages: approved.filter(m => m.mappedStageId).length,
          unmappedCount: approved.filter(m => !m.mappedStageId).length
        });

        // Categories with custom workflow requirements
        const hasCustomWorkflow = Object.values(result.categoryAssignments).some(cat => cat.requiresCustomWorkflow === true);
        
        if (hasCustomWorkflow) {
          console.log('🔧 Custom workflow detected - showing category configuration');
        }
        
        toast({
          title: "Preview Ready",
          description: `Found ${approved.length} stage mappings ready for review.`
        });
        
      } catch (previewError) {
        console.error('Preview generation error:', previewError);
        
        // Fallback: show simple mapping list
        const approved = Object.values(result.rowMappings).flat();
        setApprovedMappings(approved);
        setFilteredMappings(approved);
        
        toast({
          title: "Preview Generated",
          description: `Showing ${approved.length} mappings (fallback mode).`,
          variant: "default"
        });
      }
      
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: "Preview Failed",
        description: "Could not generate preview. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleConfirm = async () => {
    if (!result) return;

    try {
      // Extract all approved mappings from the result
      const allApprovedMappings = Object.values(result.rowMappings || {}).flat();
      
      // Map to the expected format
      const userApprovedMappings = allApprovedMappings.map(mapping => ({
        groupName: mapping.groupName,
        mappedStageId: mapping.mappedStageId,
        mappedStageName: mapping.mappedStageName,
        category: mapping.category
      }));

      console.log('🎯 CONFIRM - Sending user approved mappings:', {
        count: userApprovedMappings.length,
        mappings: userApprovedMappings
      });

      await onConfirm(userApprovedMappings);
    } catch (error) {
      console.error('Confirmation error:', error);
      toast({
        title: "Error",
        description: "Failed to process job creation. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Show final result if available
  if (finalResult) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Jobs Created Successfully
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Success Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Creation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{finalResult.stats.successful}</div>
                    <div className="text-sm text-green-700">Jobs Created</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{finalResult.stats.workflowsInitialized}</div>
                    <div className="text-sm text-blue-700">Workflows</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{finalResult.stats.total}</div>
                    <div className="text-sm text-gray-700">Total Processed</div>
                  </div>
                </div>

                {finalResult.stats.successful > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-700">All jobs created successfully with proper workflows!</span>
                  </div>
                )}

                <Progress 
                  value={(finalResult.stats.successful / finalResult.stats.total) * 100} 
                  className="w-full"
                />
                <p className="text-sm text-center text-muted-foreground">
                  {finalResult.stats.successful} of {finalResult.stats.total} jobs completed successfully
                </p>
              </CardContent>
            </Card>

            {/* New Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                {finalResult.newCategories && finalResult.newCategories.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">New Categories Created:</h4>
                    {finalResult.newCategories.map((category: any, index: number) => (
                      <Badge key={index} variant="secondary">
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Job Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Details</CardTitle>
                <CardDescription>Successfully created jobs with workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {finalResult.jobs && finalResult.jobs.map((job, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <div>
                        <p className="font-medium">{job.wo_no}</p>
                        <p className="text-sm text-muted-foreground">{job.customer}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Created
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Errors (if any) */}
            {finalResult.stats.errors && finalResult.stats.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-red-600">Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <h4 className="font-medium text-red-600">Errors ({finalResult.stats.errors.length})</h4>
                    {finalResult.stats.errors.map((error, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                          <div>
                            <p className="text-sm text-red-600">{error}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-red-700 border-red-300">
                          Failed
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {finalResult.stats.errors && finalResult.stats.errors.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-700">Some jobs had issues but others were created successfully.</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show creation preview/confirmation dialog
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enhanced Job Creation Preview</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Statistics */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-600">{stats.totalJobs}</div>
                    <div className="text-sm text-blue-700">Jobs</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">{stats.totalMappings}</div>
                    <div className="text-sm text-green-700">Mappings</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-xl font-bold text-purple-600">{stats.categoriesDetected}</div>
                    <div className="text-sm text-purple-700">Categories</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-xl font-bold text-yellow-600">
                      {stats.requiresApproval ? 'Yes' : 'No'}
                    </div>
                    <div className="text-sm text-yellow-700">Needs Review</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Assignments */}
          {result?.categoryAssignments && Object.keys(result.categoryAssignments).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category Assignments</CardTitle>
                <CardDescription>Detected categories for your jobs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(result.categoryAssignments).map(([woNo, category]) => (
                  <div key={woNo} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="font-medium">{woNo}</p>
                        <p className="text-sm text-muted-foreground">{category.categoryName || 'Unknown Category'}</p>
                      </div>
                    </div>
                    
                    <span className="text-sm text-muted-foreground">Category assignment</span>
                    
                    <Badge variant="default">Standard Workflow</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Stage Mappings Preview */}
          {filteredMappings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stage Mappings</CardTitle>
                <CardDescription>Detected workflow stages for your jobs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-60 overflow-y-auto">
                {filteredMappings.map((mapping, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        mapping.mappedStageId ? "bg-green-500" : "bg-yellow-500"
                      )} />
                      <div>
                        <p className="font-medium">{mapping.groupName}</p>
                        <p className="text-sm text-muted-foreground">
                          {mapping.mappedStageName || 'Unmapped stage'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={mapping.mappedStageId ? "default" : "destructive"}>
                      {mapping.category}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handlePreview}>
                Preview Details
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90"
              >
                {isLoading ? 'Creating Jobs...' : 'Confirm & Create Jobs'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
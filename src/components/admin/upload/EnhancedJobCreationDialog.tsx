import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, AlertTriangle, Zap, Factory, Workflow, Database, Settings } from "lucide-react";
import type { EnhancedJobCreationResult } from "@/utils/excel/enhancedJobCreator";
import type { CategoryAssignmentResult } from "@/utils/excel/productionStageMapper";
import type { RowMappingResult } from "@/utils/excel/types";
import { RowMappingTable } from "./RowMappingTable";
import { supabase } from "@/integrations/supabase/client";

interface EnhancedJobCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: EnhancedJobCreationResult | null;
  isProcessing: boolean;
  onConfirm: () => void;
}

interface AvailableStage {
  id: string;
  name: string;
  category: string;
}

interface AvailableCategory {
  id: string;
  name: string;
  color: string;
}

export const EnhancedJobCreationDialog: React.FC<EnhancedJobCreationDialogProps> = ({
  open,
  onOpenChange,
  result,
  isProcessing,
  onConfirm
}) => {
  const [selectedTab, setSelectedTab] = useState("mapping");
  const [availableStages, setAvailableStages] = useState<AvailableStage[]>([]);
  const [availableCategories, setAvailableCategories] = useState<AvailableCategory[]>([]);
  const [updatedRowMappings, setUpdatedRowMappings] = useState<{ [woNo: string]: RowMappingResult[] }>({});

  // Safely access result properties
  const safeResult = result || {
    success: false,
    createdJobs: [],
    failedJobs: [],
    categoryAssignments: {},
    rowMappings: {},
    stats: { total: 0, successful: 0, failed: 0, newCategories: 0, workflowsInitialized: 0 }
  };

  useEffect(() => {
    loadAvailableStages();
    loadAvailableCategories();
  }, []);

  useEffect(() => {
    if (result?.rowMappings) {
      // Initialize updatedRowMappings with current result data from the correct location
      const initialMappings: { [woNo: string]: RowMappingResult[] } = {};
      Object.entries(safeResult.rowMappings).forEach(([woNo, mappings]) => {
        if (mappings && mappings.length > 0) {
          initialMappings[woNo] = [...mappings];
        }
      });
      setUpdatedRowMappings(initialMappings);
      console.log('Initialized row mappings:', initialMappings);
    }
  }, [result]);

  const loadAvailableStages = async () => {
    try {
      const { data: stages, error } = await supabase
        .from('production_stages')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Map stages to categories based on common naming patterns
      const mappedStages = (stages || []).map(stage => ({
        id: stage.id,
        name: stage.name,
        category: inferStageCategory(stage.name, stage.description)
      }));

      setAvailableStages(mappedStages);
    } catch (error) {
      console.error('Failed to load available stages:', error);
    }
  };

  const loadAvailableCategories = async () => {
    try {
      const { data: categories, error } = await supabase
        .from('categories')
        .select('id, name, color')
        .order('name');

      if (error) throw error;

      setAvailableCategories(categories || []);
    } catch (error) {
      console.error('Failed to load available categories:', error);
    }
  };

  const inferStageCategory = (name: string, description?: string): string => {
    const text = `${name} ${description || ''}`.toLowerCase();
    
    if (text.includes('print') || text.includes('hp') || text.includes('xerox') || text.includes('digital')) {
      return 'printing';
    }
    if (text.includes('finish') || text.includes('laminat') || text.includes('cut') || text.includes('fold') || text.includes('bind')) {
      return 'finishing';
    }
    if (text.includes('prepress') || text.includes('dtp') || text.includes('proof') || text.includes('plate')) {
      return 'prepress';
    }
    if (text.includes('deliver') || text.includes('dispatch') || text.includes('ship')) {
      return 'delivery';
    }
    
    return 'unknown';
  };

  const handleUpdateMapping = (rowIndex: number, stageId: string, stageName: string) => {
    setUpdatedRowMappings(prev => {
      const updated = { ...prev };
      
      // Find which work order this row belongs to
      for (const [woNo, mappings] of Object.entries(result?.rowMappings || {})) {
        const mappingIndex = mappings.findIndex(m => m.excelRowIndex === rowIndex);
        
        if (mappingIndex >= 0) {
          if (!updated[woNo]) updated[woNo] = [...mappings];
          
          const mappingsCopy = [...updated[woNo]];
          mappingsCopy[mappingIndex] = {
            ...mappingsCopy[mappingIndex],
            mappedStageId: stageId,
            mappedStageName: stageName,
            manualOverride: true,
            confidence: 100,
            isUnmapped: false
          };
          updated[woNo] = mappingsCopy;
          break;
        }
      }
      
      return updated;
    });
  };

  const handleUpdateCategory = (woNo: string, categoryId: string | null, categoryName: string | null) => {
    // Update category assignment in result
    if (safeResult.categoryAssignments[woNo]) {
      safeResult.categoryAssignments[woNo].categoryId = categoryId;
      safeResult.categoryAssignments[woNo].categoryName = categoryName;
      safeResult.categoryAssignments[woNo].requiresCustomWorkflow = !categoryId;
    }
  };

  const handleToggleManualOverride = (rowIndex: number) => {
    setUpdatedRowMappings(prev => {
      const updated = { ...prev };
      
      // Find which work order this row belongs to
      for (const [woNo, mappings] of Object.entries(result?.rowMappings || {})) {
        const mappingIndex = mappings.findIndex(m => m.excelRowIndex === rowIndex);
        
        if (mappingIndex >= 0) {
          if (!updated[woNo]) updated[woNo] = [...mappings];
          
          const mappingsCopy = [...updated[woNo]];
          mappingsCopy[mappingIndex] = {
            ...mappingsCopy[mappingIndex],
            manualOverride: !mappingsCopy[mappingIndex].manualOverride
          };
          updated[woNo] = mappingsCopy;
          break;
        }
      }
      
      return updated;
    });
  };

  const getTotalUnmappedRows = () => {
    try {
      if (!updatedRowMappings || typeof updatedRowMappings !== 'object') return 0;
      
      return Object.values(updatedRowMappings).reduce((total, mappings) => {
        if (!Array.isArray(mappings)) return total;
        return total + mappings.filter(m => m && typeof m === 'object' && m.isUnmapped).length;
      }, 0);
    } catch (error) {
      console.error('Error calculating unmapped rows:', error);
      return 0;
    }
  };

  if (!result && !isProcessing) return null;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 bg-green-100";
    if (confidence >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return "High";
    if (confidence >= 60) return "Medium";
    return "Low";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Enhanced Production Job Creation
          </DialogTitle>
          <DialogDescription>
            Creating fully qualified work orders with automatic stage mapping and workflow initialization
          </DialogDescription>
        </DialogHeader>

        {isProcessing ? (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <div className="text-center">
              <p className="font-medium">Processing Excel data...</p>
              <p className="text-sm text-gray-600">Mapping stages, assigning categories, and initializing workflows</p>
            </div>
          </div>
        ) : result ? (
          <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
            {/* Statistics Overview with comprehensive null safety */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold">{safeResult?.stats?.total || 0}</div>
                      <div className="text-sm text-gray-600">Total Jobs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-600">{safeResult?.stats?.successful || 0}</div>
                      <div className="text-sm text-gray-600">Successful</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-purple-600" />
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{safeResult?.stats?.workflowsInitialized || safeResult?.stats?.successful || 0}</div>
                      <div className="text-sm text-gray-600">Workflows</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{safeResult.stats.newCategories}</div>
                      <div className="text-sm text-gray-600">New Categories</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Success Rate Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Processing Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress 
                    value={(safeResult.stats.successful / safeResult.stats.total) * 100} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{safeResult.stats.successful} successful</span>
                    <span>{safeResult.stats.failed} failed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Results */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                <TabsTrigger value="mapping" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Settings className="h-3 w-3" />
                  <span className="hidden sm:inline">Row Mapping</span>
                  <span className="sm:hidden">Mapping</span>
                  {getTotalUnmappedRows() > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                      {getTotalUnmappedRows()}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="overview" className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">Job Overview</span>
                  <span className="sm:hidden">Overview</span>
                </TabsTrigger>
                <TabsTrigger value="jobs" className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">Created Jobs</span>
                  <span className="sm:hidden">Jobs</span>
                </TabsTrigger>
                <TabsTrigger value="errors" className="text-xs sm:text-sm">Issues</TabsTrigger>
              </TabsList>

              <TabsContent value="mapping" className="flex-1 overflow-y-auto space-y-4">
                {safeResult.rowMappings && Object.entries(safeResult.rowMappings).map(([woNo, mappings]) => {
                  const currentMappings = updatedRowMappings[woNo] || mappings || [];
                  
                  return (
                    <Card key={woNo}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>Work Order: {woNo}</span>
                          <div className="flex items-center gap-2">
                            {currentMappings.filter(m => m.isUnmapped).length > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {currentMappings.filter(m => m.isUnmapped).length} unmapped
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {currentMappings.length} rows
                            </Badge>
                          </div>
                        </CardTitle>
                        <CardDescription>
                          Review and adjust the automatic stage mappings for each Excel row
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <RowMappingTable
                          rowMappings={currentMappings}
                          availableStages={availableStages}
                        onUpdateMapping={handleUpdateMapping}
                        onToggleManualOverride={handleToggleManualOverride}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="overview" className="flex-1 overflow-y-auto space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Category Assignment Results</CardTitle>
                    <CardDescription>
                      How work orders were categorized and which production stages were mapped
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">Work Order</TableHead>
                            <TableHead className="min-w-[100px]">Category</TableHead>
                            <TableHead className="min-w-[80px]">Confidence</TableHead>
                            <TableHead className="min-w-[200px]">Mapped Stages</TableHead>
                            <TableHead className="min-w-[100px]">Workflow Type</TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {Object.entries(safeResult.categoryAssignments).map(([woNo, assignment]) => (
                          <TableRow key={woNo}>
                            <TableCell className="font-medium">{woNo}</TableCell>
                             <TableCell>
                               <Badge variant="outline" className="text-blue-600 border-blue-600">
                                 Custom Workflow
                               </Badge>
                             </TableCell>
                            <TableCell>
                              <Badge className={getConfidenceColor(assignment.confidence)}>
                                {getConfidenceLabel(assignment.confidence)} ({assignment.confidence.toFixed(0)}%)
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {assignment.mappedStages.map((stage, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {stage.stageName}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {assignment.requiresCustomWorkflow ? (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  Custom
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Standard
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="jobs" className="flex-1 overflow-y-auto space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Successfully Created Jobs</CardTitle>
                    <CardDescription>
                      Production jobs ready for the manufacturing floor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">Work Order</TableHead>
                            <TableHead className="min-w-[150px]">Customer</TableHead>
                            <TableHead className="min-w-[80px]">Quantity</TableHead>
                            <TableHead className="min-w-[100px]">Category</TableHead>
                            <TableHead className="min-w-[120px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {safeResult.createdJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">{job.wo_no}</TableCell>
                            <TableCell>{job.customer || 'N/A'}</TableCell>
                            <TableCell>{job.qty}</TableCell>
                            <TableCell>
                              {safeResult.categoryAssignments[job.wo_no]?.categoryName || (
                                <span className="text-gray-500 italic">Custom</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-700">
                                Ready for Production
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="errors" className="flex-1 overflow-y-auto space-y-4">
                {safeResult.failedJobs.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        Failed Jobs ({safeResult.failedJobs.length})
                      </CardTitle>
                      <CardDescription>
                        Jobs that could not be processed due to errors
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Work Order</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {safeResult.failedJobs.map((failedJob, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{failedJob.job.wo_no}</TableCell>
                              <TableCell>{failedJob.job.customer || 'N/A'}</TableCell>
                              <TableCell className="text-red-600 text-sm">{failedJob.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                      <h3 className="font-semibold text-green-700">All Jobs Processed Successfully!</h3>
                      <p className="text-gray-600 mt-2">
                        No errors occurred during the job creation process.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Review Later
              </Button>
              <div className="flex items-center gap-2">
                {getTotalUnmappedRows() > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {getTotalUnmappedRows()} unmapped rows require attention
                  </Badge>
                )}
                <Button 
                  onClick={onConfirm} 
                  className="flex items-center gap-2"
                  disabled={getTotalUnmappedRows() > 0}
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirm & Continue to Production
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
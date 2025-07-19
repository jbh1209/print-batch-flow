
import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, Clock, Users, Factory, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import type { EnhancedJobCreationResult } from "@/utils/excel/enhancedJobCreator";
import type { RowMappingResult } from "@/utils/excel/types";

interface EnhancedJobCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: EnhancedJobCreationResult | null;
  isProcessing: boolean;
  onConfirm: (userApprovedMappings?: Array<{
    groupName: string;
    mappedStageId: string;
    mappedStageName: string;
    category: string;
  }>) => void;
}

export const EnhancedJobCreationDialog: React.FC<EnhancedJobCreationDialogProps> = ({
  open,
  onOpenChange,
  result,
  isProcessing,
  onConfirm,
}) => {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [userMappingOverrides, setUserMappingOverrides] = useState<{[key: string]: string}>({});

  // Safely get mappedStages with fallback
  const mappedStages = useMemo(() => {
    if (!result?.mappedStages || !Array.isArray(result.mappedStages)) {
      return [];
    }
    return result.mappedStages as RowMappingResult[];
  }, [result?.mappedStages]);

  const toggleJobExpansion = (woNo: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(woNo)) {
      newExpanded.delete(woNo);
    } else {
      newExpanded.add(woNo);
    }
    setExpandedJobs(newExpanded);
  };

  if (!result) {
    return null;
  }

  // Calculate statistics with safe array access
  const totalRows = result.stats?.total || 0;
  const mappedRows = mappedStages.length;
  const unmappedRows = mappedStages.filter(stage => stage.isUnmapped).length;
  const highConfidenceRows = mappedStages.filter(stage => !stage.isUnmapped && stage.confidence > 80).length;
  const mediumConfidenceRows = mappedStages.filter(stage => !stage.isUnmapped && stage.confidence > 50 && stage.confidence <= 80).length;
  const lowConfidenceRows = mappedStages.filter(stage => !stage.isUnmapped && stage.confidence <= 50).length;

  const overallConfidence = mappedRows > 0 ? 
    mappedStages.filter(stage => !stage.isUnmapped).reduce((sum, stage) => sum + stage.confidence, 0) / mappedStages.filter(stage => !stage.isUnmapped).length : 
    0;

  const handleConfirm = () => {
    // Convert user overrides to the expected format
    const userApprovedMappings = Object.entries(userMappingOverrides).map(([key, stageId]) => {
      const [groupName] = key.split('|');
      const mappedStage = mappedStages.find(stage => stage.mappedStageId === stageId);
      return {
        groupName,
        mappedStageId: stageId,
        mappedStageName: mappedStage?.mappedStageName || '',
        category: mappedStage?.category || 'unknown'
      };
    });

    onConfirm(userApprovedMappings.length > 0 ? userApprovedMappings : undefined);
  };

  const renderConfidenceBadge = (confidence: number) => {
    if (confidence > 80) {
      return <Badge variant="default" className="bg-green-100 text-green-800">High ({confidence}%)</Badge>;
    } else if (confidence > 50) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium ({confidence}%)</Badge>;
    } else {
      return <Badge variant="destructive" className="bg-red-100 text-red-800">Low ({confidence}%)</Badge>;
    }
  };

  const requiresCustomWorkflow = result.requiresCustomWorkflow || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Enhanced Production Job Creation - Ready for Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overview Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Processing Summary</CardTitle>
                <Factory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRows}</div>
                <p className="text-xs text-muted-foreground">Total rows processed</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Mapped:</span>
                    <span className="font-medium text-green-600">{mappedRows - unmappedRows}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Unmapped:</span>
                    <span className="font-medium text-red-600">{unmappedRows}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mapping Confidence</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(overallConfidence)}%</div>
                <p className="text-xs text-muted-foreground">Average confidence</p>
                <Progress value={overallConfidence} className="mt-2" />
                <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                  <div className="text-center">
                    <div className="font-medium text-green-600">{highConfidenceRows}</div>
                    <div>High</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-yellow-600">{mediumConfidenceRows}</div>
                    <div>Med</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600">{lowConfidenceRows}</div>
                    <div>Low</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Workflow Status</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {requiresCustomWorkflow ? 'Custom' : 'Standard'}
                </div>
                <p className="text-xs text-muted-foreground">Workflow type detected</p>
                <div className="mt-2">
                  {requiresCustomWorkflow ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      <Clock className="h-3 w-3 mr-1" />
                      Requires Review
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Auto-Approved
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Mapping Results */}
          <Tabs defaultValue="by-job" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="by-job">By Work Order</TabsTrigger>
              <TabsTrigger value="by-stage">By Production Stage</TabsTrigger>
            </TabsList>

            <TabsContent value="by-job">
              <Card>
                <CardHeader>
                  <CardTitle>Work Order Mapping Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {Object.entries(result.rowMappings || {}).map(([woNo, stages]) => {
                        const isExpanded = expandedJobs.has(woNo);
                        const stagesArray = Array.isArray(stages) ? stages : [];
                        
                        return (
                          <div key={woNo} className="border rounded-lg p-3">
                            <div 
                              className="flex items-center justify-between cursor-pointer"
                              onClick={() => toggleJobExpansion(woNo)}
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-medium">WO: {woNo}</span>
                                <Badge variant="outline">{stagesArray.length} stages</Badge>
                              </div>
                              <div className="flex gap-1">
                                {stagesArray.map((stage, idx) => (
                                  <div key={idx} className={`w-2 h-2 rounded-full ${
                                    stage.isUnmapped ? 'bg-red-400' :
                                    stage.confidence > 80 ? 'bg-green-400' :
                                    stage.confidence > 50 ? 'bg-yellow-400' : 'bg-red-400'
                                  }`} />
                                ))}
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="mt-3 space-y-2">
                                {stagesArray.map((stage, idx) => (
                                  <div key={idx} className="bg-gray-50 p-2 rounded text-sm">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="font-medium">{stage.groupName}</div>
                                        <div className="text-gray-600">{stage.description}</div>
                                        <div className="text-xs text-gray-500">Qty: {stage.qty}</div>
                                      </div>
                                      <div className="text-right">
                                        {stage.isUnmapped ? (
                                          <Badge variant="destructive">Unmapped</Badge>
                                        ) : (
                                          <div>
                                            <div className="text-xs font-medium">{stage.mappedStageName}</div>
                                            {renderConfidenceBadge(stage.confidence)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-stage">
              <Card>
                <CardHeader>
                  <CardTitle>Production Stage Mapping Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group/Description</TableHead>
                          <TableHead>Mapped Stage</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Work Order</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappedStages.map((mapping, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{mapping.groupName}</div>
                                <div className="text-sm text-gray-600">{mapping.description}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {mapping.isUnmapped ? (
                                <Badge variant="destructive">Not Mapped</Badge>
                              ) : (
                                <div className="text-sm">
                                  <div className="font-medium">{mapping.mappedStageName}</div>
                                  {mapping.mappedStageSpecName && (
                                    <div className="text-gray-600">{mapping.mappedStageSpecName}</div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {!mapping.isUnmapped && renderConfidenceBadge(mapping.confidence)}
                            </TableCell>
                            <TableCell>{mapping.qty}</TableCell>
                            <TableCell className="text-sm font-mono">
                              {/* Extract WO from the first job that matches this mapping */}
                              {Object.keys(result.rowMappings || {}).find(woNo => 
                                (result.rowMappings![woNo] as RowMappingResult[]).some(stage => 
                                  stage.excelRowIndex === mapping.excelRowIndex
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {unmappedRows > 0 && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  {unmappedRows} unmapped stages will be skipped
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Creating Jobs...
                  </>
                ) : (
                  <>
                    <Factory className="h-4 w-4" />
                    Create {totalRows} Production Jobs
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

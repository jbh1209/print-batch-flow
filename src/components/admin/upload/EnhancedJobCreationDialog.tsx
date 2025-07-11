import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertTriangle, Zap, Factory, Workflow, Database } from "lucide-react";
import type { EnhancedJobCreationResult } from "@/utils/excel/enhancedJobCreator";
import type { CategoryAssignmentResult } from "@/utils/excel/productionStageMapper";

interface EnhancedJobCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: EnhancedJobCreationResult | null;
  isProcessing: boolean;
  onConfirm: () => void;
}

export const EnhancedJobCreationDialog: React.FC<EnhancedJobCreationDialogProps> = ({
  open,
  onOpenChange,
  result,
  isProcessing,
  onConfirm
}) => {
  const [selectedTab, setSelectedTab] = useState("overview");

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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
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
          <div className="space-y-6">
            {/* Statistics Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold">{result.stats.total}</div>
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
                      <div className="text-2xl font-bold text-green-600">{result.stats.successful}</div>
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
                      <div className="text-2xl font-bold text-purple-600">{result.stats.workflowsInitialized}</div>
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
                      <div className="text-2xl font-bold text-orange-600">{result.stats.newCategories}</div>
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
                    value={(result.stats.successful / result.stats.total) * 100} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{result.stats.successful} successful</span>
                    <span>{result.stats.failed} failed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Results */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Category Assignments</TabsTrigger>
                <TabsTrigger value="jobs">Created Jobs</TabsTrigger>
                <TabsTrigger value="errors">Issues</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Category Assignment Results</CardTitle>
                    <CardDescription>
                      How work orders were categorized and which production stages were mapped
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Work Order</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Mapped Stages</TableHead>
                          <TableHead>Workflow Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(result.categoryAssignments).map(([woNo, assignment]) => (
                          <TableRow key={woNo}>
                            <TableCell className="font-medium">{woNo}</TableCell>
                            <TableCell>
                              {assignment.categoryName || (
                                <span className="text-gray-500 italic">Custom workflow</span>
                              )}
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
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="jobs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Successfully Created Jobs</CardTitle>
                    <CardDescription>
                      Production jobs ready for the manufacturing floor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Work Order</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.createdJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">{job.wo_no}</TableCell>
                            <TableCell>{job.customer || 'N/A'}</TableCell>
                            <TableCell>{job.qty}</TableCell>
                            <TableCell>
                              {result.categoryAssignments[job.wo_no]?.categoryName || (
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
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="errors" className="space-y-4">
                {result.failedJobs.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        Failed Jobs ({result.failedJobs.length})
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
                          {result.failedJobs.map((failedJob, idx) => (
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
              <Button onClick={onConfirm} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Confirm & Continue to Production
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
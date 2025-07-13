import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertTriangle, Zap, Factory, Workflow, Database } from "lucide-react";
import type { UnifiedImportResult, UnifiedJobResult, UnifiedStageInstance } from "@/utils/excel/v2/UnifiedImportTypes";

interface SimplifiedJobCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: UnifiedImportResult | null;
  isProcessing: boolean;
  onConfirm: () => void;
}

export const SimplifiedJobCreationDialog: React.FC<SimplifiedJobCreationDialogProps> = ({
  open,
  onOpenChange,
  result,
  isProcessing,
  onConfirm
}) => {
  const [selectedTab, setSelectedTab] = useState("overview");

  if (!result) {
    return null;
  }

  const { jobs, stats, errors, debugInfo } = result;
  const successfulJobs = jobs.filter(job => job.success);
  const failedJobs = jobs.filter(job => !job.success);

  const getStageIcon = (category: string) => {
    switch (category) {
      case 'printing': return <Zap className="h-4 w-4" />;
      case 'finishing': return <Factory className="h-4 w-4" />;
      case 'prepress': return <Workflow className="h-4 w-4" />;
      case 'delivery': return <Database className="h-4 w-4" />;
      default: return <Factory className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'printing': return 'bg-blue-100 text-blue-800';
      case 'finishing': return 'bg-green-100 text-green-800';
      case 'prepress': return 'bg-purple-100 text-purple-800';
      case 'delivery': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Excel Import Results - V2 Architecture
          </DialogTitle>
          <DialogDescription>
            Processed {stats.total} jobs with {stats.successful} successful and {stats.failed} failed
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Job Overview</TabsTrigger>
            <TabsTrigger value="stages">Stage Mapping</TabsTrigger>
            <TabsTrigger value="details">Job Details</TabsTrigger>
            <TabsTrigger value="issues">Issues & Debug</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-600">Successful</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-600">Total Stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.totalStages}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    Printing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{stats.printingStages}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    <Factory className="h-4 w-4" />
                    Finishing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{stats.finishingStages}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    <Workflow className="h-4 w-4" />
                    Prepress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{stats.prepressStages}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1">
                    <Database className="h-4 w-4" />
                    Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{stats.deliveryStages}</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Progress value={(stats.successful / stats.total) * 100} className="w-64" />
                <p className="text-sm text-gray-600 mt-1">
                  {Math.round((stats.successful / stats.total) * 100)}% success rate
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Stage Mapping Tab */}
          <TabsContent value="stages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stage Distribution</CardTitle>
                <CardDescription>
                  Overview of all detected production stages across jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Stage Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Part</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {successfulJobs.map((job) =>
                      job.stageInstances.map((stage, index) => (
                        <TableRow key={`${job.woNo}-${index}`}>
                          <TableCell className="font-medium">{job.woNo}</TableCell>
                          <TableCell>{stage.stageName}</TableCell>
                          <TableCell>
                            <Badge className={getCategoryColor(stage.category)}>
                              {getStageIcon(stage.category)}
                              <span className="ml-1">{stage.category}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>{stage.quantity}</TableCell>
                          <TableCell>{stage.partName || stage.partType || 'Main'}</TableCell>
                          <TableCell>
                            {stage.isValid ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Valid
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">
                                <XCircle className="h-3 w-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4">
              {successfulJobs.map((job) => (
                <Card key={job.woNo}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Job: {job.woNo}</span>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Success
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Customer: {job.jobData.customer || 'N/A'} | 
                      Reference: {job.jobData.reference || 'N/A'} |
                      Quantity: {job.jobData.qty || 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Job Information</h4>
                        <div className="text-sm space-y-1">
                          <p><strong>Due Date:</strong> {job.jobData.due_date || 'Not set'}</p>
                          <p><strong>Rep:</strong> {job.jobData.rep || 'N/A'}</p>
                          <p><strong>Category:</strong> {job.jobData.category || 'General'}</p>
                          <p><strong>Location:</strong> {job.jobData.location || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Production Stages ({job.stageInstances.length})</h4>
                        <div className="space-y-1">
                          {job.stageInstances.map((stage, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              {getStageIcon(stage.category)}
                              <span>{stage.stageName}</span>
                              <Badge variant="outline" className="text-xs">
                                {stage.quantity}x
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Issues & Debug Tab */}
          <TabsContent value="issues" className="space-y-4">
            {errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Processing Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {errors.map((error, index) => (
                      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                        {error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {failedJobs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    Failed Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Number</TableHead>
                        <TableHead>Errors</TableHead>
                        <TableHead>Stages Detected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedJobs.map((job) => (
                        <TableRow key={job.woNo}>
                          <TableCell className="font-medium">{job.woNo}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {job.errors.map((error, index) => (
                                <div key={index} className="text-sm text-red-600">{error}</div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{job.stageInstances.length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Debug Information</CardTitle>
                <CardDescription>Processing details and logs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {debugInfo.map((info, index) => (
                    <div key={index} className="text-sm font-mono p-2 bg-gray-50 rounded">
                      {info}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={isProcessing || stats.successful === 0}
            className="min-w-32"
          >
            {isProcessing ? "Creating Jobs..." : `Create ${stats.successful} Jobs`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
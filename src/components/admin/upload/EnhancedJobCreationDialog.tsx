
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, FileText, Users, Layers, MapPin } from "lucide-react";
import { 
  type EnhancedJobCreationResult, // Import from types
  type RowMappingResult 
} from "@/utils/excel/types";

interface EnhancedJobCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  preparationResult: EnhancedJobCreationResult | null;
  onCreateJobs: () => void;
  isCreating: boolean;
}

const EnhancedJobCreationDialog: React.FC<EnhancedJobCreationDialogProps> = ({
  isOpen,
  onClose,
  preparationResult,
  onCreateJobs,
  isCreating
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'mapping' | 'jobs'>('overview');

  // Add null checks and fallbacks for all data access
  const preparedJobs = preparationResult?.preparedJobs || [];
  const stats = preparationResult?.stats || { total: 0, successful: 0, failed: 0, errors: [] };
  const stageMappingResult = preparationResult?.stageMappingResult;
  const mappedRows = stageMappingResult?.mappedRows || [];
  const unmappedRows = stageMappingResult?.unmappedRows || [];

  if (!preparationResult) {
    return null;
  }

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{preparedJobs.length}</div>
            <p className="text-xs text-muted-foreground">Jobs Prepared</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{mappedRows.length}</div>
            <p className="text-xs text-muted-foreground">Mapped Stages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{unmappedRows.length}</div>
            <p className="text-xs text-muted-foreground">Unmapped Stages</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Indicators */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {stats.successful > 0 ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          )}
          <span className="font-medium">Job Preparation Status</span>
          <Badge variant={stats.successful > 0 ? "default" : "secondary"}>
            {stats.successful}/{stats.total} Successful
          </Badge>
        </div>

        {stats.errors && stats.errors.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {stats.errors.length} errors encountered during preparation
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );

  const renderMappingTab = () => {
    // Add null checks for all mapping operations
    const highConfidenceMapped = mappedRows.filter((row: any) => 
      row?.confidence && row.confidence > 0.8
    ) || [];
    
    const lowConfidenceMapped = mappedRows.filter((row: any) => 
      row?.confidence && row.confidence <= 0.8 && row.confidence > 0
    ) || [];
    
    const printingOperations = mappedRows.filter((row: any) => 
      row?.category === 'printing'
    ) || [];
    
    const finishingOperations = mappedRows.filter((row: any) => 
      row?.category === 'finishing'
    ) || [];

    const needsReview = unmappedRows.filter((row: any) => 
      row?.isUnmapped && (unmappedRows.length > 0)
    ) || [];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Mapping Confidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">High Confidence</span>
                <Badge variant="default">{highConfidenceMapped.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Low Confidence</span>
                <Badge variant="secondary">{lowConfidenceMapped.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Needs Review</span>
                <Badge variant="destructive">{needsReview.length}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Stage Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Printing</span>
                <Badge>{printingOperations.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Finishing</span>
                <Badge>{finishingOperations.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mapping Details */}
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {mappedRows.map((row: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <Badge variant={row?.confidence > 0.8 ? "default" : "secondary"}>
                    {Math.round((row?.confidence || 0) * 100)}%
                  </Badge>
                  <span className="font-medium">{row?.groupName || 'Unknown'}</span>
                  <span className="text-sm text-muted-foreground">{row?.description || ''}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{row?.mappedStageName || 'Unmapped'}</div>
                  <div className="text-xs text-muted-foreground">Qty: {row?.qty || 0}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderJobsTab = () => (
    <ScrollArea className="h-96">
      <div className="space-y-4">
        {preparedJobs.map((job: any, index: number) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{job?.wo_number || `Job ${index + 1}`}</CardTitle>
                <Badge>{job?.status || 'Unknown'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Customer:</span> {job?.customer || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Quantity:</span> {job?.quantity || 0}
                </div>
                <div>
                  <span className="font-medium">Reference:</span> {job?.reference || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Due Date:</span> {job?.due_date || 'N/A'}
                </div>
              </div>
              {job?._stageMappings && job._stageMappings.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Stage Mappings: {job._stageMappings.length}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Enhanced Job Creation Preview</DialogTitle>
          <DialogDescription>
            Review the prepared jobs and stage mappings before creating them
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-b">
          {[
            { key: 'overview', label: 'Overview', icon: FileText },
            { key: 'mapping', label: 'Stage Mapping', icon: Layers },
            { key: 'jobs', label: 'Jobs', icon: Users }
          ].map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={activeTab === key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(key as any)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'mapping' && renderMappingTab()}
          {activeTab === 'jobs' && renderJobsTab()}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Ready to create {preparedJobs.length} jobs with {mappedRows.length} stage mappings
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={onCreateJobs} 
              disabled={isCreating || preparedJobs.length === 0}
            >
              {isCreating ? "Creating Jobs..." : `Create ${preparedJobs.length} Jobs`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedJobCreationDialog;

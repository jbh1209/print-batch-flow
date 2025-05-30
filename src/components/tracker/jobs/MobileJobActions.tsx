
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  QrCode, 
  Play, 
  CheckCircle, 
  Clock, 
  Smartphone,
  Share2,
  Edit,
  MoreVertical,
  Sync
} from "lucide-react";
import { useJobStageManagement } from "@/hooks/tracker/useJobStageManagement";
import { useMobileQRScanner } from "@/hooks/tracker/useMobileQRScanner";

interface MobileJobActionsProps {
  job: any;
  onJobUpdate: () => void;
  onEditJob: () => void;
  onSyncJob: () => void;
}

export const MobileJobActions: React.FC<MobileJobActionsProps> = ({
  job,
  onJobUpdate,
  onEditJob,
  onSyncJob
}) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const {
    jobStages,
    initializeJobWorkflow,
    getCurrentStage,
    getWorkflowProgress
  } = useJobStageManagement({
    jobId: job.id,
    jobTableName: 'production_jobs',
    categoryId: job.category_id
  });

  const { hasShareSupport } = useMobileQRScanner();

  const currentStage = getCurrentStage();
  const progress = getWorkflowProgress();

  const handleInitializeWorkflow = async () => {
    const success = await initializeJobWorkflow();
    if (success) {
      onJobUpdate();
      setIsSheetOpen(false);
    }
  };

  const handleShareJob = async () => {
    if (hasShareSupport() && job.qr_code_url) {
      try {
        await navigator.share({
          title: `Job ${job.wo_no}`,
          text: `Work Order: ${job.wo_no}\nCustomer: ${job.customer || 'N/A'}`,
          url: job.qr_code_url
        });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'in-progress') return 'bg-blue-100 text-blue-800';
    if (status === 'on-hold') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Job Actions
          </SheetTitle>
          <SheetDescription>
            Quick actions for {job.wo_no}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-4">
          {/* Job Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{job.wo_no}</CardTitle>
                <Badge className={getStatusColor(job.status)}>
                  {job.status}
                </Badge>
              </div>
              {job.customer && (
                <p className="text-sm text-gray-600">{job.customer}</p>
              )}
            </CardHeader>
            <CardContent>
              {progress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progress.completed}/{progress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Stage */}
          {currentStage && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Current Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: currentStage.production_stage.color }}
                  />
                  <span className="font-medium">{currentStage.production_stage.name}</span>
                  <Badge variant="outline" className="ml-auto">
                    Stage {currentStage.stage_order}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!job.category_id && (
                <Button
                  onClick={handleInitializeWorkflow}
                  className="w-full flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Initialize Workflow
                </Button>
              )}

              {job.qr_code_url && (
                <Button
                  variant="outline"
                  onClick={handleShareJob}
                  className="w-full flex items-center gap-2"
                  disabled={!hasShareSupport()}
                >
                  <QrCode className="h-4 w-4" />
                  Share QR Code
                </Button>
              )}

              <Button
                variant="outline"
                onClick={onEditJob}
                className="w-full flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Job
              </Button>

              <Button
                variant="outline"
                onClick={onSyncJob}
                className="w-full flex items-center gap-2"
              >
                <Sync className="h-4 w-4" />
                Sync Data
              </Button>
            </CardContent>
          </Card>

          {/* Mobile Features */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Mobile Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Share Support</span>
                <Badge variant={hasShareSupport() ? "default" : "secondary"}>
                  {hasShareSupport() ? "Available" : "Not Available"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>QR Code Ready</span>
                <Badge variant={job.qr_code_url ? "default" : "secondary"}>
                  {job.qr_code_url ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Workflow Initialized</span>
                <Badge variant={job.category_id ? "default" : "secondary"}>
                  {job.category_id ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Stage Timeline (if workflow exists) */}
          {jobStages.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Stage Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {jobStages.slice(0, 4).map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        {stage.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {stage.status === 'active' && <Play className="h-4 w-4 text-blue-600" />}
                        {stage.status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                        <span className={`${stage.status === 'active' ? 'font-medium' : ''}`}>
                          {stage.production_stage.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {stage.status}
                      </Badge>
                    </div>
                  ))}
                  {jobStages.length > 4 && (
                    <div className="text-xs text-gray-500 text-center pt-2">
                      +{jobStages.length - 4} more stages
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

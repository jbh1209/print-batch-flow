import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User,
  Calendar,
  Clock,
  Package,
  MapPin,
  Hash,
  AlertTriangle,
  CheckCircle,
  Timer,
  QrCode,
  FileText,
  Printer,
  Play,
  Pause,
  RotateCcw,
  StickyNote,
  Scan,
  Target
} from "lucide-react";
import { format } from "date-fns";
import { ScheduledJobStage } from "@/hooks/tracker/useScheduledJobs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GlobalBarcodeListener } from "./GlobalBarcodeListener";
import { PrintSpecsBadge } from "./PrintSpecsBadge";
import { SubSpecificationBadge } from "../common/SubSpecificationBadge";
import { supabase } from "@/integrations/supabase/client";

interface EnhancedJobDetailsModalProps {
  job: ScheduledJobStage | null;
  isOpen: boolean;
  onClose: () => void;
  onStartJob?: (jobId: string) => Promise<boolean>;
  onCompleteJob?: (jobId: string) => Promise<boolean>;
  scanCompleted?: boolean;
}

export const EnhancedJobDetailsModal: React.FC<EnhancedJobDetailsModalProps> = ({
  job,
  isOpen,
  onClose,
  onStartJob,
  onCompleteJob,
  scanCompleted: externalScanCompleted = false
}) => {
  const [operatorNotes, setOperatorNotes] = useState("");
  const [reworkReason, setReworkReason] = useState("");
  const [qualityIssue, setQualityIssue] = useState("");
  const [activeTab, setActiveTab] = useState("scanning");
  const [scanRequired, setScanRequired] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobSpecs, setJobSpecs] = useState<{
    print_specs?: string;
    paper_specs?: string; 
    sheet_size?: string;
  }>({});
  const [specsLoading, setSpecsLoading] = useState(false);
  
  // Use external scan state (managed by parent)
  const scanCompleted = externalScanCompleted;

  // Fetch job specifications - copy proven logic from usePersonalOperatorQueue
  const fetchJobSpecifications = async (jobId: string, stageInstanceId: string) => {
    try {
      setSpecsLoading(true);
      
      // Fetch print specifications
      const { data: printSpecs } = await supabase.rpc('get_job_specifications', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs'
      });

      // Fetch HP12000 paper size info
      const { data: hp12000Data } = await supabase.rpc('get_job_hp12000_stages', {
        p_job_id: jobId
      });

      // Parse print specifications
      const printingSpecs = printSpecs?.find(spec => spec.category === 'printing');
      const laminationSpec = printSpecs?.find(spec => spec.category === 'lamination_type')?.display_name;
      const paperSpecs = printSpecs?.filter(spec => ['paper_type', 'paper_weight'].includes(spec.category));
      
      // Build print specs string
      let printSpecsString = '';
      if (printingSpecs?.properties) {
        const props = printingSpecs.properties as any;
        const colours = props.colours || props.colors || props.Colors || props.colours_mode;
        const sides = props.sides || props.Sides || props.simplex_duplex || props.SimplexDuplex;
        if (colours && sides) {
          printSpecsString = `${colours} (${sides})`;
        } else if (colours) {
          printSpecsString = String(colours);
        }
      }
      // Fallback: use lamination as print spec if available
      if (!printSpecsString && laminationSpec && laminationSpec !== 'None') {
        printSpecsString = `Lamination: ${laminationSpec}`;
      }

      // Build paper specs string
      let paperSpecsString = '';
      if (paperSpecs?.length > 0) {
        const paperType = paperSpecs.find(s => s.category === 'paper_type')?.display_name;
        const paperWeight = paperSpecs.find(s => s.category === 'paper_weight')?.display_name;
        if (paperWeight && paperType) {
          paperSpecsString = `${paperWeight} ${paperType}`;
        } else if (paperWeight || paperType) {
          paperSpecsString = String(paperWeight || paperType);
        }
      }

      // Get sheet size and possible part-specific fallbacks from HP12000 data (match current stage instance)
      let sheetSize = '';
      let stageRow: any | undefined = undefined;
      if (hp12000Data?.length > 0) {
        stageRow = hp12000Data.find((r: any) => r.stage_instance_id === stageInstanceId);
        const paperSize = stageRow?.paper_size_name as string | undefined;
        if (paperSize) {
          sheetSize = paperSize; // Use exact name from DB (e.g., Large/Small)
        }
      }

      // Fallback to HP12000 part-specific paper specs when job-level specs are missing
      if (!paperSpecsString && stageRow?.paper_specifications) {
        const specs = stageRow.paper_specifications as Record<string, any>;
        const pType = specs.paper_type || specs.PaperType;
        const pWeight = specs.paper_weight || specs.PaperWeight;
        if (pType || pWeight) {
          paperSpecsString = [pWeight, pType].filter(Boolean).join(' ');
        } else {
          const keys = Object.keys(specs || {});
          if (keys.length > 0) paperSpecsString = keys[0];
        }
      }

      // Fallback to HP12000 printing specs if available
      if (!printSpecsString && stageRow?.printing_specifications) {
        const ps = stageRow.printing_specifications as Record<string, any>;
        const colours = ps.colours || ps.colors;
        const sides = ps.sides || ps.simplex_duplex;
        if (colours && sides) {
          printSpecsString = `${colours} (${sides})`;
        } else if (colours) {
          printSpecsString = String(colours);
        }
      }

      setJobSpecs({
        print_specs: printSpecsString,
        paper_specs: paperSpecsString,
        sheet_size: sheetSize
      });
    } catch (error) {
      console.error('Error fetching job specifications:', error);
      setJobSpecs({});
    } finally {
      setSpecsLoading(false);
    }
  };

  // Reset tab when modal opens and fetch specs
  useEffect(() => {
    if (isOpen) {
      setActiveTab("scanning");
      if (job?.job_id && job?.id) {
        fetchJobSpecifications(job.job_id, job.id);
      }
    }
  }, [isOpen, job?.job_id, job?.id]);

  if (!job) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      return format(new Date(dateString), 'PPP p');
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusInfo = () => {
    if (job.status === 'active') {
      return { 
        text: 'In Progress', 
        color: 'bg-green-100 text-green-800 border-green-300',
        icon: Timer,
        canComplete: true,
        canStart: false
      };
    }
    if (job.is_ready_now) {
      return { 
        text: 'Ready to Start', 
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: Play,
        canComplete: false,
        canStart: true
      };
    }
    if (job.is_scheduled_later) {
      return { 
        text: 'Scheduled Later', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: Clock,
        canComplete: false,
        canStart: false
      };
    }
    if (job.is_waiting_for_dependencies) {
      return { 
        text: 'Waiting for Dependencies', 
        color: 'bg-gray-100 text-gray-800 border-gray-300',
        icon: Pause,
        canComplete: false,
        canStart: false
      };
    }
    return { 
      text: 'Pending', 
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: Timer,
      canComplete: false,
      canStart: false
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const handleStartJob = async () => {
    if (!onStartJob) return;
    
    if (!scanCompleted) {
      toast.error('Please scan the job QR code before starting');
      setActiveTab('scanning');
      return;
    }
    
    setIsProcessing(true);
    try {
      const success = await onStartJob(job.id);
      if (success) {
        toast.success(`Started job ${job.wo_no}`);
        onClose();
      }
    } catch (error) {
      toast.error('Failed to start job');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!onCompleteJob) return;
    
    setIsProcessing(true);
    try {
      const success = await onCompleteJob(job.id);
      if (success) {
        toast.success(`Completed job ${job.wo_no}`);
        onClose();
      }
    } catch (error) {
      toast.error('Failed to complete job');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkForRework = () => {
    if (!reworkReason.trim()) {
      toast.error('Please specify a rework reason');
      return;
    }
    // TODO: Implement rework functionality
    toast.info('Rework functionality coming soon');
  };

  const handleQualityHold = () => {
    if (!qualityIssue.trim()) {
      toast.error('Please specify the quality issue');
      return;
    }
    // TODO: Implement quality hold functionality
    toast.info('Quality hold functionality coming soon');
  };

  const generateQRCode = () => {
    // For now, just a simple string - in real implementation, this would be a proper QR code
    return `JOB:${job.wo_no}:STAGE:${job.stage_name}:ID:${job.id}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl h-[90vh] max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            {job.wo_no} - {job.stage_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="scanning">Overview & Scanning</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="notes">Notes & Issues</TabsTrigger>
            <TabsTrigger value="details">Job Details</TabsTrigger>
          </TabsList>

          <TabsContent value="scanning" className="space-y-6">
            {/* Mandatory Scanning Section */}
            <Card className={cn("border-2", scanCompleted ? "border-green-500 bg-green-50" : "border-orange-500 bg-orange-50")}>
              <CardHeader>
                <CardTitle className={cn("text-lg flex items-center gap-2", scanCompleted ? "text-green-700" : "text-orange-700")}>
                  <Scan className="w-5 h-5" />
                  {scanCompleted ? "✓ Job Scanned Successfully" : "⚠ Scan Required Before Starting"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-8 rounded-lg border text-center">
                  <QrCode className="w-32 h-32 text-gray-400 mx-auto mb-4" />
                  <div className="text-lg font-bold mb-2">{job.wo_no}</div>
                  <div className="text-sm text-gray-600 mb-4">{job.stage_name}</div>
                  <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                    {generateQRCode()}
                  </div>
                </div>
                
                {!scanCompleted ? (
                  <div className="text-center text-orange-700 font-medium">
                    Listening for barcode scan… Present the job QR code to the scanner.
                  </div>
                ) : (
                  <div className="text-center text-green-700 font-medium">
                    ✓ Ready to start production
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Job Overview */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">{job.wo_no}</h2>
                    <p className="text-xl text-gray-600 mt-1">{job.customer}</p>
                    <div className="flex items-center gap-4 mt-4 text-lg text-gray-600">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        <span className="font-medium">Qty:</span>
                        <span className="font-mono text-2xl font-bold">{job.qty.toLocaleString()}</span>
                      </div>
                      {job.due_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5" />
                          <span className="font-medium">Due:</span>
                          <span className="font-semibold">{format(new Date(job.due_date), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-3">
                    <Badge className={`${statusInfo.color} border px-4 py-2 text-lg`}>
                      <StatusIcon className="w-5 h-5 mr-2" />
                      {statusInfo.text}
                    </Badge>
                    <div className="text-lg font-medium text-gray-700">
                      {job.stage_name}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            {/* Job Header with Enhanced Status */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{job.wo_no}</h2>
                    <p className="text-lg text-gray-600 mt-1">{job.customer}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span className="font-medium">Qty:</span>
                        <span className="font-mono text-lg">{job.qty.toLocaleString()}</span>
                      </div>
                      {job.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Due:</span>
                          <span>{format(new Date(job.due_date), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge className={`${statusInfo.color} border px-4 py-2 text-sm`}>
                      <StatusIcon className="w-4 h-4 mr-2" />
                      {statusInfo.text}
                    </Badge>
                    {job.queue_position && (
                      <div className="text-sm text-gray-600">
                        Queue Position: #{job.queue_position}
                      </div>
                    )}
                  </div>
                </div>

                {/* Category & Stage Details */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Category</h3>
                    <Badge 
                      variant="outline"
                      style={{ 
                        borderColor: job.category_color,
                        color: job.category_color 
                      }}
                      className="text-sm px-3 py-1"
                    >
                      {job.category_name}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Current Stage</h3>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" style={{ color: job.stage_color }} />
                      <span className="font-medium" style={{ color: job.stage_color }}>
                        {job.stage_name}
                      </span>
                      <span className="text-sm text-gray-500">(Order: {job.stage_order})</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scheduling Information */}
            {(job.scheduled_start_at || job.estimated_duration_minutes) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Scheduling Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {job.scheduled_start_at && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium text-gray-700">Scheduled Start:</span>
                      <span className="font-mono">{formatDate(job.scheduled_start_at)}</span>
                    </div>
                  )}
                  {job.scheduled_end_at && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium text-gray-700">Scheduled End:</span>
                      <span className="font-mono">{formatDate(job.scheduled_end_at)}</span>
                    </div>
                  )}
                  {job.estimated_duration_minutes && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Estimated Duration:</span>
                      <span className="font-mono">{Math.round(job.estimated_duration_minutes)} minutes</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Print Specifications */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Printer className="w-5 h-5" />
                  Print Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {specsLoading ? (
                  <div className="text-sm text-gray-600">Loading specifications...</div>
                ) : (jobSpecs.print_specs || jobSpecs.paper_specs || jobSpecs.sheet_size) ? (
                  <PrintSpecsBadge
                    printSpecs={jobSpecs.print_specs}
                    paperSpecs={jobSpecs.paper_specs}
                    sheetSize={jobSpecs.sheet_size}
                    size="normal"
                  />
                ) : (
                  <SubSpecificationBadge jobId={job.job_id} stageId={job.id} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            {/* Workflow Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Production Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {statusInfo.canStart && (
                    <Button
                      onClick={handleStartJob}
                      disabled={isProcessing || !scanCompleted}
                      className={cn(
                        "h-12",
                        scanCompleted 
                          ? "bg-blue-600 hover:bg-blue-700" 
                          : "bg-gray-400 cursor-not-allowed"
                      )}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {scanCompleted ? "Start Production" : "Scan Required First"}
                    </Button>
                  )}
                  
                  {statusInfo.canComplete && (
                    <Button
                      onClick={handleCompleteJob}
                      disabled={isProcessing}
                      className="h-12 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Complete Stage
                    </Button>
                  )}
                </div>

                {job.status === 'active' && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={handleMarkForRework}
                      className="h-10 border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Mark for Rework
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={handleQualityHold}
                      className="h-10 border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Quality Hold
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Part Assignment & Dependencies */}
            {(job.part_assignment || job.dependency_group) && (
              <div className="grid grid-cols-2 gap-4">
                {job.part_assignment && job.part_assignment !== 'both' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Part Assignment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className="text-sm">
                        {job.part_assignment}
                      </Badge>
                    </CardContent>
                  </Card>
                )}
                
                {job.dependency_group && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Dependencies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {job.dependency_group}
                      </code>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            {/* Operator Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <StickyNote className="w-5 h-5" />
                  Operator Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Add production notes, material observations, or completion comments..."
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  rows={4}
                />
                <Button variant="outline" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  Save Notes
                </Button>
              </CardContent>
            </Card>

            {/* Rework Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-orange-700">Rework Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={reworkReason} onValueChange={setReworkReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rework reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material_defect">Material Defect</SelectItem>
                    <SelectItem value="print_quality">Print Quality Issue</SelectItem>
                    <SelectItem value="wrong_settings">Wrong Settings</SelectItem>
                    <SelectItem value="operator_error">Operator Error</SelectItem>
                    <SelectItem value="machine_malfunction">Machine Malfunction</SelectItem>
                    <SelectItem value="customer_change">Customer Change Request</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={handleMarkForRework}
                  className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Submit Rework Request
                </Button>
              </CardContent>
            </Card>

            {/* Quality Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-700">Quality Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Describe quality issue or concern..."
                  value={qualityIssue}
                  onChange={(e) => setQualityIssue(e.target.value)}
                  rows={3}
                />
                <Button 
                  variant="outline" 
                  onClick={handleQualityHold}
                  className="w-full border-red-200 text-red-700 hover:bg-red-50"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Place Quality Hold
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="barcode" className="space-y-6">
            {/* QR Code for Scanning */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Job QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="bg-gray-100 p-8 rounded-lg inline-block">
                  <QrCode className="w-24 h-24 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-600 mt-2">QR Code for {job.wo_no}</p>
                </div>
                <div className="text-sm font-mono bg-gray-50 p-3 rounded border">
                  {generateQRCode()}
                </div>
                <p className="text-sm text-gray-600">
                  Scan this code to quickly start or complete this job stage
                </p>
              </CardContent>
            </Card>

            {/* Mobile Scanner Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scan className="w-5 h-5" />
                  Scanner Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full h-12">
                  <Scan className="w-5 h-5 mr-2" />
                  Scan to Start Job
                </Button>
                <Button variant="outline" className="w-full h-12">
                  <Scan className="w-5 h-5 mr-2" />
                  Scan to Complete Job
                </Button>
                <Button variant="outline" className="w-full h-12">
                  <Printer className="w-5 h-5 mr-2" />
                  Print Job Label
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Footer Actions */}
        <div className="flex gap-3 pt-6 border-t">
          {statusInfo.canStart && (
            <Button
              onClick={handleStartJob}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Job
            </Button>
          )}
          
          {statusInfo.canComplete && (
            <Button
              onClick={handleCompleteJob}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Job
            </Button>
          )}

          <Button variant="outline" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
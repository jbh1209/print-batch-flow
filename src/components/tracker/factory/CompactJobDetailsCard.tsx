import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  Calendar, 
  User, 
  Hash,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface StatusBadgeInfo {
  text: string;
  className: string;
  variant: "default" | "destructive" | "secondary" | "outline";
}

interface CompactJobDetailsCardProps {
  job: AccessibleJob;
  statusInfo: StatusBadgeInfo;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const CompactJobDetailsCard: React.FC<CompactJobDetailsCardProps> = ({ 
  job, 
  statusInfo,
  notes,
  onNotesChange
}) => {
  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  // Get appropriate icon based on status
  const getStatusIcon = (text: string) => {
    if (text.includes('Progress')) return <Clock className="h-4 w-4" />;
    if (text.includes('Completed')) return <CheckCircle className="h-4 w-4" />;
    if (text.includes('Overdue')) return <AlertTriangle className="h-4 w-4" />;
    return <Play className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Job Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="focus:ring-0 focus:ring-offset-0">Details</TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2 focus:ring-0 focus:ring-offset-0">
              <FileText className="h-4 w-4" />
              Notes
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Job Overview Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Work Order:</span>
                  <span className="font-bold">{job.wo_no}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Customer:</span>
                  <span>{job.customer || 'Unknown'}</span>
                </div>

                {job.category_name && (
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: job.category_color || '#6B7280' }}
                    />
                    <span className="text-sm font-medium">Category:</span>
                    <span>{job.category_name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {job.due_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Due Date:</span>
                    <span className={
                      isOverdue ? "text-red-600 font-bold" : 
                      isDueSoon ? "text-orange-600 font-medium" : 
                      "text-foreground"
                    }>
                      {new Date(job.due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Progress:</span>
                  <span className="font-bold">{job.workflow_progress}%</span>
                  <span className="text-xs text-muted-foreground">
                    ({job.completed_stages}/{job.total_stages} stages)
                  </span>
                </div>
              </div>
            </div>

            {/* Current Stage Section */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: job.current_stage_color || '#6B7280' }}
                  />
                  <div>
                    <h3 className="font-semibold">
                      {job.current_stage_name || 'No Stage Assigned'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Stage {job.completed_stages + 1} of {job.total_stages}
                    </p>
                  </div>
                </div>
                
                <Badge 
                  className={cn(statusInfo.className)}
                  variant={statusInfo.variant}
                >
                  {getStatusIcon(statusInfo.text)}
                  <span className="ml-1">{statusInfo.text}</span>
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Workflow Progress</span>
                  <span className="text-sm font-bold">{job.workflow_progress}%</span>
                </div>
                <Progress value={job.workflow_progress} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 bg-muted rounded-lg">
                  <div className="text-lg font-bold text-green-600">{job.completed_stages}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-2 bg-muted rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {job.total_stages - job.completed_stages}
                  </div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="notes" className="mt-4">
            <Textarea
              placeholder="Add notes about your work on this job..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="min-h-[120px]"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
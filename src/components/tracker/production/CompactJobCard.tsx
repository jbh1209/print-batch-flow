
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight,
  Calendar, 
  User, 
  Package, 
  MapPin,
  Clock,
  Play,
  CheckCircle,
  MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JobStageProgress } from "../JobStageProgress";

interface CompactJobCardProps {
  job: {
    id: string;
    wo_no: string;
    customer?: string;
    category?: string;
    qty?: number;
    due_date?: string;
    status: string;
    location?: string;
    reference?: string;
    current_stage?: string;
    has_workflow?: boolean;
  };
  stages?: Array<{
    id: string;
    production_stage: {
      id: string;
      name: string;
      color: string;
    };
    stage_order: number;
    status: 'pending' | 'active' | 'completed' | 'skipped';
    started_at?: string;
    completed_at?: string;
  }>;
  onStageAction?: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
}

export const CompactJobCard: React.FC<CompactJobCardProps> = ({
  job,
  stages = [],
  onStageAction
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': case 'printing': case 'finishing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const calculateProgress = () => {
    if (stages.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = stages.filter(stage => stage.status === 'completed').length;
    return {
      completed,
      total: stages.length,
      percentage: (completed / stages.length) * 100
    };
  };

  const progress = calculateProgress();
  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const handleStageAction = (stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    onStageAction?.(job.id, stageId, action);
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      isOverdue ? 'border-red-300 bg-red-50' : 
      isDueSoon ? 'border-orange-300 bg-orange-50' : 
      'border-gray-200 bg-white'
    }`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {/* Header Row - SiteFlow Style */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-sm text-gray-900 truncate">
                    {job.wo_no}
                  </h3>
                  
                  {job.customer && (
                    <span className="text-xs text-gray-600 truncate">
                      - {job.customer}
                    </span>
                  )}
                  
                  <Badge className={`text-xs ${getStatusColor(job.status)}`}>
                    {job.status}
                  </Badge>
                </div>

                {/* Quick Info Row */}
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  {job.qty && (
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span>Qty: {job.qty}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className={`${
                      isOverdue ? 'text-red-600 font-medium' : 
                      isDueSoon ? 'text-orange-600 font-medium' : 
                      'text-gray-600'
                    }`}>
                      Due: {formatDate(job.due_date)}
                    </span>
                  </div>

                  {job.current_stage && (
                    <div className="flex items-center gap-1">
                      <Play className="h-3 w-3 text-blue-500" />
                      <span className="text-blue-600 font-medium">{job.current_stage}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar - Only if has workflow */}
                {job.has_workflow && stages.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Production Progress</span>
                      <span className="text-gray-600">{progress.completed}/{progress.total}</span>
                    </div>
                    <Progress value={progress.percentage} className="h-1.5" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-3">
                {/* Quick Action Buttons */}
                {!isExpanded && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>Edit Job</DropdownMenuItem>
                    <DropdownMenuItem>Advance Stage</DropdownMenuItem>
                    <DropdownMenuItem>Generate QR</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="border-t pt-3 space-y-3">
              {/* Expanded Job Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {job.reference && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Reference:</span>
                    <span className="font-medium">{job.reference}</span>
                  </div>
                )}
                
                {job.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span>{job.location}</span>
                  </div>
                )}
                
                {job.category && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Category:</span>
                    <Badge variant="outline" className="text-xs">
                      {job.category}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Stage Progress - Expanded View */}
              {job.has_workflow && stages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-700">Production Stages</h4>
                  <JobStageProgress
                    jobStages={stages}
                    progress={progress}
                    onStartStage={(stageId) => handleStageAction(stageId, 'start')}
                    onCompleteStage={(stageId) => handleStageAction(stageId, 'complete')}
                    onQRScan={(stageId) => handleStageAction(stageId, 'qr-scan')}
                    isProcessing={false}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

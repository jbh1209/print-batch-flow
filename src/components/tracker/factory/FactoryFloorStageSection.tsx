import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight,
  Package,
  Users,
  Clock,
  Play
} from "lucide-react";
import type { ConsolidatedStage } from "@/utils/tracker/stageConsolidation";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";

interface FactoryFloorStageSectionProps {
  stage: ConsolidatedStage;
  jobs: AccessibleJob[];
  masterQueueJobs: AccessibleJob[];
  onNavigate: (path: string) => void;
}

export const FactoryFloorStageSection: React.FC<FactoryFloorStageSectionProps> = ({
  stage,
  jobs,
  masterQueueJobs,
  onNavigate
}) => {
  // Combine direct stage jobs and master queue jobs
  const allJobs = [...jobs, ...masterQueueJobs];
  const activeJobs = allJobs.filter(job => job.current_stage_status === 'active');
  const pendingJobs = allJobs.filter(job => job.current_stage_status === 'pending');

  // Determine the appropriate navigation path based on stage type
  const getNavigationPath = () => {
    const stageName = stage.stage_name.toLowerCase();
    
    if (stageName.includes('dtp')) {
      return '/tracker/dtp-workflow';
    } else if (stageName.includes('proof')) {
      return '/tracker/dtp-workflow';
    } else if (stageName.includes('batch')) {
      return '/tracker/production';
    } else if (stageName.includes('print')) {
      return '/tracker/kanban';
    } else {
      return '/tracker/kanban';
    }
  };

  // Get stage color or default
  const stageColor = stage.stage_color || '#6B7280';
  
  // Convert hex to HSL for consistent theming
  const getGradientClasses = () => {
    const stageName = stage.stage_name.toLowerCase();
    
    if (stageName.includes('dtp')) {
      return "from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg";
    } else if (stageName.includes('proof')) {
      return "from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg";
    } else if (stageName.includes('batch')) {
      return "from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg";
    } else if (stageName.includes('print')) {
      return "from-green-50 to-green-100 border-green-200 hover:shadow-lg";
    } else {
      return "from-gray-50 to-gray-100 border-gray-200 hover:shadow-lg";
    }
  };

  const getTextColor = () => {
    const stageName = stage.stage_name.toLowerCase();
    
    if (stageName.includes('dtp')) {
      return "text-blue-700";
    } else if (stageName.includes('proof')) {
      return "text-purple-700";
    } else if (stageName.includes('batch')) {
      return "text-orange-700";
    } else if (stageName.includes('print')) {
      return "text-green-700";
    } else {
      return "text-gray-700";
    }
  };

  const getButtonColor = () => {
    const stageName = stage.stage_name.toLowerCase();
    
    if (stageName.includes('dtp')) {
      return "bg-blue-600 hover:bg-blue-700";
    } else if (stageName.includes('proof')) {
      return "bg-purple-600 hover:bg-purple-700";
    } else if (stageName.includes('batch')) {
      return "bg-orange-600 hover:bg-orange-700";
    } else if (stageName.includes('print')) {
      return "bg-green-600 hover:bg-green-700";
    } else {
      return "bg-gray-600 hover:bg-gray-700";
    }
  };

  const getIcon = () => {
    const stageName = stage.stage_name.toLowerCase();
    
    if (stageName.includes('dtp')) {
      return Package;
    } else if (stageName.includes('proof')) {
      return Users;
    } else if (stageName.includes('batch')) {
      return Package;
    } else if (stageName.includes('print')) {
      return Play;
    } else {
      return Package;
    }
  };

  const Icon = getIcon();

  return (
    <Card className={`bg-gradient-to-br ${getGradientClasses()} transition-shadow cursor-pointer`}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 ${getTextColor()}`}>
          <Icon className="h-5 w-5" />
          {stage.stage_name}
          {stage.is_master_queue && (
            <Badge variant="secondary" className="text-xs">
              Master Queue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Job counts */}
          <div className="flex items-center gap-4 text-sm">
            {pendingJobs.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{pendingJobs.length} Ready</span>
              </div>
            )}
            {activeJobs.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>{activeJobs.length} Active</span>
              </div>
            )}
            {allJobs.length === 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>No jobs</span>
              </div>
            )}
          </div>

          {/* Recent jobs preview */}
          {allJobs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Recent Jobs:</p>
              <div className="space-y-1">
                {allJobs.slice(0, 3).map((job) => (
                  <div key={job.job_id} className="flex items-center justify-between text-xs">
                    <span className="truncate flex-1">{job.wo_no}</span>
                    <Badge 
                      variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {job.current_stage_status}
                    </Badge>
                  </div>
                ))}
                {allJobs.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{allJobs.length - 3} more jobs
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Navigation button */}
          <Button 
            onClick={() => onNavigate(getNavigationPath())}
            className={`w-full ${getButtonColor()}`}
            size="sm"
          >
            <span>Open {stage.stage_name}</span>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          {/* Master queue details */}
          {stage.is_master_queue && stage.subsidiary_stages.length > 0 && (
            <div className="pt-2 border-t border-white/20">
              <p className="text-xs font-medium text-muted-foreground mb-1">Includes:</p>
              <div className="flex flex-wrap gap-1">
                {stage.subsidiary_stages.map((subStage) => (
                  <Badge 
                    key={subStage.stage_id} 
                    variant="outline" 
                    className="text-xs"
                  >
                    {subStage.stage_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
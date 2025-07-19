import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Play, BookOpen, FileText } from 'lucide-react';
import { useCoverTextStageActions } from '@/hooks/tracker/useCoverTextStageActions';
import type { CoverTextDetection } from '@/utils/excel/types';

interface CoverTextWorkflowDisplayProps {
  jobId: string;
  coverTextDetection: CoverTextDetection;
  stageInstances: Array<{
    id: string;
    production_stage_id: string;
    part_name: string;
    part_type: string;
    status: string;
    dependency_group: string | null;
    stage_order: number;
    production_stages: {
      name: string;
      color: string;
    };
  }>;
  onStageComplete?: () => void;
}

export const CoverTextWorkflowDisplay: React.FC<CoverTextWorkflowDisplayProps> = ({
  jobId,
  coverTextDetection,
  stageInstances,
  onStageComplete
}) => {
  const { completeStageWithDependencyCheck, isLoading } = useCoverTextStageActions();

  const coverStages = stageInstances.filter(s => s.part_name === 'Cover');
  const textStages = stageInstances.filter(s => s.part_name === 'Text');

  const handleStageComplete = async (stage: any) => {
    const result = await completeStageWithDependencyCheck({
      jobId,
      stageId: stage.production_stage_id,
      partName: stage.part_name,
      dependencyGroup: stage.dependency_group,
    });

    if (result.success && onStageComplete) {
      onStageComplete();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active':
        return <Play className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      active: 'destructive',
      pending: 'secondary',
      'waiting-dependency': 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('-', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Book Production Workflow</h3>
        <Badge variant="outline">Cover + Text</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cover Component */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Cover Component
              <Badge variant="outline">
                {coverTextDetection.components.find(c => c.type === 'cover')?.printing.wo_qty || 0} units
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coverStages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(stage.status)}
                  <div>
                    <p className="font-medium">{stage.production_stages.name}</p>
                    <p className="text-sm text-gray-600">Order: {stage.stage_order}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(stage.status)}
                  {stage.status === 'active' && (
                    <Button
                      size="sm"
                      onClick={() => handleStageComplete(stage)}
                      disabled={isLoading}
                    >
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Text Component */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Text Component
              <Badge variant="outline">
                {coverTextDetection.components.find(c => c.type === 'text')?.printing.wo_qty || 0} units
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {textStages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(stage.status)}
                  <div>
                    <p className="font-medium">{stage.production_stages.name}</p>
                    <p className="text-sm text-gray-600">Order: {stage.stage_order}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(stage.status)}
                  {stage.status === 'active' && (
                    <Button
                      size="sm"
                      onClick={() => handleStageComplete(stage)}
                      disabled={isLoading}
                    >
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dependency Information */}
      {coverTextDetection.dependencyGroupId && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-700">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Synchronization: Some stages wait for both cover and text completion before proceeding
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
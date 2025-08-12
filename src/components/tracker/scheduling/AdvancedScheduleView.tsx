import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAdvancedScheduling } from "@/hooks/tracker/useAdvancedScheduling";
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  Calendar,
  BarChart3,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface AdvancedScheduleViewProps {
  jobId: string;
  jobTableName?: string;
  onOptimize?: () => void;
}

export const AdvancedScheduleView = ({ 
  jobId, 
  jobTableName = 'production_jobs',
  onOptimize 
}: AdvancedScheduleViewProps) => {
  const {
    advancedSchedule,
    isLoadingSchedule,
    optimizeJobFlow,
    isOptimizing,
    formatTimeEstimate,
    getScheduleConfidenceColor,
    getAlternativeTimeline,
    getBottleneckStages,
    getCriticalPathStages
  } = useAdvancedScheduling({ jobId, jobTableName });

  if (isLoadingSchedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Advanced Schedule Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">
              Calculating advanced schedule...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!advancedSchedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Advanced Schedule Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No schedule data available</p>
        </CardContent>
      </Card>
    );
  }

  const bottleneckStages = getBottleneckStages();
  const criticalPathStages = getCriticalPathStages();
  const optimisticTimeline = getAlternativeTimeline('optimistic');
  const realisticTimeline = getAlternativeTimeline('realistic');
  const pessimisticTimeline = getAlternativeTimeline('pessimistic');

  return (
    <div className="space-y-6">
      {/* Schedule Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {advancedSchedule.schedule?.scheduledCompletionDate ? 
                  formatTimeEstimate(new Date()) : 'TBD'}
              </div>
              <div className="text-sm text-muted-foreground">Estimated Start</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                5 days
              </div>
              <div className="text-sm text-muted-foreground">Total Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {advancedSchedule.schedule?.scheduledCompletionDate ? 
                  formatTimeEstimate(new Date(advancedSchedule.schedule.scheduledCompletionDate)) : 'TBD'}
              </div>
              <div className="text-sm text-muted-foreground">Completion</div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Schedule Confidence:</span>
              <Badge 
                variant={advancedSchedule.schedule?.success ? 'default' : 'destructive'}
                className={getScheduleConfidenceColor('medium')}
              >
                {advancedSchedule.schedule?.success ? 'HIGH' : 'LOW'}
              </Badge>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => optimizeJobFlow(undefined)}
              disabled={isOptimizing}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {isOptimizing ? 'Optimizing...' : 'Optimize Flow'}
            </Button>
          </div>

          {advancedSchedule.validation?.errors?.length > 0 && (
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Validation Issues</span>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                {advancedSchedule.validation.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alternative Timeline Scenarios */}
      {(optimisticTimeline || realisticTimeline || pessimisticTimeline) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Timeline Scenarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {optimisticTimeline && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {optimisticTimeline.days} days
                  </div>
                  <div className="text-sm text-green-700">Optimistic</div>
                  <div className="text-xs text-green-600 mt-1">
                    {optimisticTimeline.probability}% confidence
                  </div>
                </div>
              )}
              {realisticTimeline && (
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {realisticTimeline.days} days
                  </div>
                  <div className="text-sm text-blue-700">Realistic</div>
                  <div className="text-xs text-blue-600 mt-1">
                    {realisticTimeline.probability}% confidence
                  </div>
                </div>
              )}
              {pessimisticTimeline && (
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-600">
                    {pessimisticTimeline.days} days
                  </div>
                  <div className="text-sm text-red-700">Pessimistic</div>
                  <div className="text-xs text-red-600 mt-1">
                    {pessimisticTimeline.probability}% confidence
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Positions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Stage Queue Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {advancedSchedule.queuePositions.map((position, index) => (
              <div key={position.stageId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{position.stageName}</span>
                    {position.isBottleneck && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Bottleneck
                      </Badge>
                    )}
                    {advancedSchedule.criticalPath.includes(position.stageId) && (
                      <Badge variant="secondary">
                        Critical Path
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Position {position.position} of {position.totalInQueue}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Queue: </span>
                    <span className="font-medium">
                      {Math.round(position.queueDaysAhead * 10) / 10} days
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start: </span>
                    <span className="font-medium">
                      {formatTimeEstimate(position.estimatedStartDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Complete: </span>
                    <span className="font-medium">
                      {formatTimeEstimate(position.estimatedCompletionDate)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {index < advancedSchedule.queuePositions.length - 1 ? (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>

                <Progress 
                  value={(position.position / position.totalInQueue) * 100} 
                  className="h-2"
                />

                {index < advancedSchedule.queuePositions.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottlenecks and Critical Path */}
      {(bottleneckStages.length > 0 || criticalPathStages.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bottleneckStages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Bottleneck Stages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bottleneckStages.map(stage => (
                    <div key={stage.stageId} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <span className="font-medium">{stage.stageName}</span>
                      <span className="text-sm text-red-600">
                        {Math.round(stage.queueDaysAhead * 10) / 10} day queue
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {criticalPathStages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Critical Path
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {criticalPathStages.map(stage => (
                    <div key={stage.stageId} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span className="font-medium">{stage.stageName}</span>
                      <span className="text-sm text-blue-600">
                        {formatTimeEstimate(stage.estimatedStartDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
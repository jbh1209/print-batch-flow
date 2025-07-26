import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DynamicReschedulingEngine, ProductionChange, RescheduleRecommendation, ScheduleConflict } from '@/services/dynamicReschedulingEngine';
import { 
  Zap, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Play, 
  Pause, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Brain,
  Target
} from 'lucide-react';
import { toast } from 'sonner';

export const DynamicReschedulingDashboard: React.FC = () => {
  const [engine] = useState(() => DynamicReschedulingEngine.getInstance());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [recentChanges, setRecentChanges] = useState<ProductionChange[]>([]);
  const [recommendations, setRecommendations] = useState<RescheduleRecommendation[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [reschedulingPlan, setReschedulingPlan] = useState<any>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  useEffect(() => {
    return () => {
      engine.stopMonitoring();
    };
  }, [engine]);

  const handleStartMonitoring = async () => {
    try {
      await engine.startMonitoring();
      setIsMonitoring(true);
      toast.success('Dynamic rescheduling monitoring started');
      
      // Start periodic updates
      const interval = setInterval(async () => {
        const changes = await engine.detectProductionChanges();
        setRecentChanges(prev => [...changes, ...prev].slice(0, 10));
        setLastUpdateTime(new Date().toLocaleTimeString());
      }, 30000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Error starting monitoring:', error);
      toast.error('Failed to start monitoring');
    }
  };

  const handleStopMonitoring = () => {
    engine.stopMonitoring();
    setIsMonitoring(false);
    toast.info('Dynamic rescheduling monitoring stopped');
  };

  const handleDetectChanges = async () => {
    try {
      const changes = await engine.detectProductionChanges();
      setRecentChanges(changes);
      setLastUpdateTime(new Date().toLocaleTimeString());
      
      if (changes.length > 0) {
        toast.success(`Detected ${changes.length} production changes`);
      } else {
        toast.info('No new production changes detected');
      }
    } catch (error) {
      console.error('Error detecting changes:', error);
      toast.error('Failed to detect changes');
    }
  };

  const handleDetectConflicts = async () => {
    try {
      const detectedConflicts = await engine.detectScheduleConflicts();
      setConflicts(detectedConflicts);
      
      if (detectedConflicts.length > 0) {
        toast.warning(`Found ${detectedConflicts.length} schedule conflicts`);
      } else {
        toast.success('No schedule conflicts detected');
      }
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      toast.error('Failed to detect conflicts');
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setIsGeneratingPlan(true);
      const plan = await engine.generateReschedulingPlan();
      setReschedulingPlan(plan);
      setRecommendations(plan.recommendations);
      setConflicts(plan.conflicts);
      toast.success('Rescheduling plan generated successfully');
    } catch (error) {
      console.error('Error generating plan:', error);
      toast.error('Failed to generate rescheduling plan');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'job_added': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'job_expedited': return <Zap className="h-4 w-4 text-warning" />;
      case 'delay_reported': return <Clock className="h-4 w-4 text-destructive" />;
      case 'machine_down': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Activity className="h-4 w-4 text-primary" />;
    }
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-warning text-warning-foreground';
      case 'medium': return 'bg-info text-info-foreground';
      case 'low': return 'bg-success text-success-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'error': return 'bg-warning text-warning-foreground';
      case 'warning': return 'bg-info text-info-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dynamic Rescheduling Engine</h2>
          <p className="text-muted-foreground">
            AI-powered real-time production adaptation {lastUpdateTime && `• Last updated: ${lastUpdateTime}`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
            variant={isMonitoring ? "destructive" : "default"}
          >
            {isMonitoring ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
          <Button onClick={handleDetectChanges} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Detect Changes
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className={`h-4 w-4 ${isMonitoring ? 'text-success' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-2xl font-bold">{isMonitoring ? 'ACTIVE' : 'STOPPED'}</p>
                <p className="text-xs text-muted-foreground">Monitoring Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-2xl font-bold">{recentChanges.length}</p>
                <p className="text-xs text-muted-foreground">Recent Changes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <div>
                <p className="text-2xl font-bold">{conflicts.length}</p>
                <p className="text-xs text-muted-foreground">Active Conflicts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-info" />
              <div>
                <p className="text-2xl font-bold">{recommendations.length}</p>
                <p className="text-xs text-muted-foreground">AI Recommendations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
          <TabsTrigger value="conflicts">Schedule Conflicts</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
          <TabsTrigger value="planning">Rescheduling Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Production Change Detection</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentChanges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No production changes detected yet.
                  {!isMonitoring && ' Start monitoring to begin real-time detection.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentChanges.map((change) => (
                    <div key={change.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div className="flex items-center space-x-3">
                        {getChangeTypeIcon(change.type)}
                        <div>
                          <div className="font-medium">
                            {change.type.replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {change.job_id && `Job: ${change.details?.wo_no || change.job_id}`}
                            {change.stage_id && ` • Stage: ${change.stage_id}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getImpactColor(change.impact_level)}>
                          {change.impact_level} impact
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(change.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Schedule Conflicts</h3>
            <Button onClick={handleDetectConflicts} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Detect Conflicts
            </Button>
          </div>

          {conflicts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
                No schedule conflicts detected. Production is running smoothly.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {conflicts.map((conflict) => (
                <Card key={conflict.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-5 w-5 text-warning" />
                          <span className="font-medium">
                            {conflict.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <Badge className={getSeverityColor(conflict.severity)}>
                          {conflict.severity}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        Affects {conflict.affected_jobs.length} jobs • 
                        Estimated delay: {conflict.estimated_delay_hours}h
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium">Resolution Suggestions:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {conflict.resolution_suggestions.map((suggestion, i) => (
                            <li key={i}>• {suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">AI Recommendations</h3>
            <Badge variant="outline">
              {recommendations.filter(r => r.auto_apply).length} auto-applicable
            </Badge>
          </div>

          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 text-primary" />
                No AI recommendations available. Generate a rescheduling plan to see suggestions.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <Card key={rec.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Target className="h-5 w-5 text-primary" />
                          <span className="font-medium">
                            {rec.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {rec.auto_apply && (
                            <Badge variant="secondary">Auto-Apply</Badge>
                          )}
                          <Badge variant="outline">
                            {rec.confidence_score}% confidence
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm">
                        <span>
                          Impact: <span className={rec.estimated_impact_hours < 0 ? 'text-success' : 'text-warning'}>
                            {rec.estimated_impact_hours > 0 ? '+' : ''}{rec.estimated_impact_hours}h
                          </span>
                        </span>
                        <span>Affects: {rec.affected_jobs.length} jobs</span>
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium">Reasoning:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {rec.reasoning.map((reason, i) => (
                            <li key={i}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <Progress value={rec.confidence_score} className="w-32" />
                        <div className="space-x-2">
                          <Button variant="outline" size="sm">
                            Review Details
                          </Button>
                          <Button size="sm" disabled={rec.auto_apply}>
                            {rec.auto_apply ? 'Auto-Applied' : 'Apply Recommendation'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Comprehensive Rescheduling Plans</h3>
            <Button 
              onClick={handleGeneratePlan} 
              disabled={isGeneratingPlan}
            >
              {isGeneratingPlan ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Plan
                </>
              )}
            </Button>
          </div>

          {reschedulingPlan ? (
            <div className="space-y-4">
              <Alert>
                <Brain className="h-4 w-4" />
                <AlertDescription>
                  <strong>Plan Assessment:</strong> {reschedulingPlan.risk_assessment} • 
                  Estimated improvement: {Math.abs(reschedulingPlan.estimated_improvement_hours)}h saved
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Plan Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Recommendations:</span>
                      <Badge variant="outline">{reschedulingPlan.recommendations.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Conflicts:</span>
                      <Badge variant={reschedulingPlan.conflicts.length > 0 ? "destructive" : "success"}>
                        {reschedulingPlan.conflicts.length}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Time Impact:</span>
                      <span className={reschedulingPlan.estimated_improvement_hours < 0 ? 'text-success' : 'text-warning'}>
                        {reschedulingPlan.estimated_improvement_hours > 0 ? '+' : ''}
                        {reschedulingPlan.estimated_improvement_hours}h
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Risk Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        {reschedulingPlan.risk_assessment}
                      </div>
                      <Progress 
                        value={
                          reschedulingPlan.risk_assessment.includes('High') ? 85 :
                          reschedulingPlan.risk_assessment.includes('Medium') ? 50 : 25
                        } 
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center space-x-4">
                <Button variant="outline">
                  Export Plan
                </Button>
                <Button>
                  Implement Plan
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 text-primary" />
                Generate a comprehensive rescheduling plan to optimize production workflow.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
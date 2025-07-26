import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { SmartQueueManager, SmartQueue, QueuedJob, BatchOptimizationSuggestion } from '@/services/smartQueueManager';
import { AlertTriangle, Clock, Users, TrendingUp, Zap, Package } from 'lucide-react';
import { toast } from 'sonner';

export const SmartQueueDashboard: React.FC = () => {
  const [smartQueues, setSmartQueues] = useState<SmartQueue[]>([]);
  const [laminationQueues, setLaminationQueues] = useState<Record<string, QueuedJob[]>>({});
  const [batchSuggestions, setBatchSuggestions] = useState<BatchOptimizationSuggestion[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQueueData();
  }, []);

  const loadQueueData = async () => {
    try {
      setIsLoading(true);
      const [queues, lamination] = await Promise.all([
        SmartQueueManager.getSmartQueues(),
        SmartQueueManager.getLaminationQueues()
      ]);
      
      setSmartQueues(queues);
      setLaminationQueues(lamination);
      
      // Auto-select highest risk queue for batch suggestions
      const highRiskQueue = queues.find(q => q.bottleneck_risk === 'high');
      if (highRiskQueue) {
        setSelectedQueue(highRiskQueue.id);
        loadBatchSuggestions(highRiskQueue.id);
      }
    } catch (error) {
      console.error('Error loading queue data:', error);
      toast.error('Failed to load queue data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBatchSuggestions = async (queueId: string) => {
    try {
      const suggestions = await SmartQueueManager.getBatchSuggestions(queueId);
      setBatchSuggestions(suggestions);
    } catch (error) {
      console.error('Error loading batch suggestions:', error);
      toast.error('Failed to load batch suggestions');
    }
  };

  const handleQueueSelect = (queueId: string) => {
    setSelectedQueue(queueId);
    loadBatchSuggestions(queueId);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      default: return 'bg-success text-success-foreground';
    }
  };

  const getCapacityColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-success';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Smart Queue Management</h2>
          <p className="text-muted-foreground">Intelligent batching and queue optimization</p>
        </div>
        <Button onClick={loadQueueData} variant="outline">
          <TrendingUp className="h-4 w-4 mr-2" />
          Refresh Queues
        </Button>
      </div>

      <Tabs defaultValue="queues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queues">Production Queues</TabsTrigger>
          <TabsTrigger value="lamination">Lamination Queues</TabsTrigger>
          <TabsTrigger value="batching">Batch Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {smartQueues.map((queue) => (
              <Card key={queue.id} className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => handleQueueSelect(queue.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{queue.name}</CardTitle>
                    <Badge className={getRiskColor(queue.bottleneck_risk)}>
                      {queue.bottleneck_risk} risk
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{queue.jobs.length} jobs</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Capacity</span>
                      <span>{Math.round((queue.current_load / queue.total_capacity) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(queue.current_load / queue.total_capacity) * 100}
                      className="h-2"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{Math.round(queue.estimated_completion_hours)}h estimated</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="lamination" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(laminationQueues).map(([type, jobs]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">
                    {type === 'none' ? 'No Lamination' : `${type} Lamination`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{jobs.length} jobs</span>
                    </div>
                    
                    {jobs.slice(0, 3).map((job) => (
                      <div key={job.job_id} className="p-2 bg-muted rounded-md">
                        <div className="font-medium text-sm">{job.wo_no}</div>
                        <div className="text-xs text-muted-foreground">{job.customer}</div>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="outline" className="text-xs">
                            Priority: {Math.round(job.priority_score)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Due: {new Date(job.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {jobs.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{jobs.length - 3} more jobs
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="batching" className="space-y-4">
          {selectedQueue && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  Batch Suggestions for {smartQueues.find(q => q.id === selectedQueue)?.name}
                </h3>
              </div>
              
              {batchSuggestions.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No batch optimization suggestions available for this queue.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {batchSuggestions.map((suggestion, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Batch Suggestion #{index + 1}
                          </CardTitle>
                          <Badge variant="secondary">
                            {suggestion.efficiency_score}% efficiency
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-medium text-success">
                              {suggestion.material_savings}%
                            </div>
                            <div className="text-muted-foreground">Material Savings</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-primary">
                              {suggestion.time_savings_hours}h
                            </div>
                            <div className="text-muted-foreground">Time Savings</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">
                              {suggestion.suggested_jobs.length}
                            </div>
                            <div className="text-muted-foreground">Jobs</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Jobs in Batch:</h4>
                          {suggestion.suggested_jobs.map((job) => (
                            <div key={job.job_id} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                              <span className="font-medium">{job.wo_no}</span>
                              <span className="text-muted-foreground">{job.customer}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="space-y-1">
                          <h4 className="font-medium text-sm">Optimization Reasoning:</h4>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {suggestion.reasoning.map((reason, i) => (
                              <li key={i}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <Button className="w-full" size="sm">
                          Create Batch
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
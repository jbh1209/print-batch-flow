import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SmartQueueManager, BatchOptimizationSuggestion, SmartQueue } from '@/services/smartQueueManager';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';
import { productConfigs } from '@/config/productTypes';
import { Zap, TrendingUp, Package, Clock, DollarSign, Target } from 'lucide-react';
import { toast } from 'sonner';

interface BatchOptimizationEngineProps {
  queues: SmartQueue[];
  onBatchCreated: () => void;
}

export const BatchOptimizationEngine: React.FC<BatchOptimizationEngineProps> = ({
  queues,
  onBatchCreated
}) => {
  const [suggestions, setSuggestions] = useState<Record<string, BatchOptimizationSuggestion[]>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<BatchOptimizationSuggestion | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Use business cards config as default for batch creation
  const { createBatchWithSelectedJobs, isCreatingBatch } = useGenericBatches(
    productConfigs.BUSINESS_CARDS
  );

  useEffect(() => {
    if (queues.length > 0) {
      analyzeAllQueues();
    }
  }, [queues]);

  const analyzeAllQueues = async () => {
    setIsAnalyzing(true);
    try {
      const allSuggestions: Record<string, BatchOptimizationSuggestion[]> = {};
      
      for (const queue of queues) {
        if (queue.jobs.length >= 2) {
          const queueSuggestions = await SmartQueueManager.getBatchSuggestions(queue.id, 8);
          if (queueSuggestions.length > 0) {
            allSuggestions[queue.id] = queueSuggestions;
          }
        }
      }
      
      setSuggestions(allSuggestions);
      
      // Auto-select first high-efficiency suggestion
      const allSuggs = Object.values(allSuggestions).flat();
      const topSuggestion = allSuggs.sort((a, b) => b.efficiency_score - a.efficiency_score)[0];
      if (topSuggestion) {
        setSelectedSuggestion(topSuggestion);
      }
      
    } catch (error) {
      console.error('Error analyzing queues:', error);
      toast.error('Failed to analyze batch optimization opportunities');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateBatch = async (suggestion: BatchOptimizationSuggestion) => {
    try {
      // Convert QueuedJob to BaseJob format for batch creation
      const batchJobs = suggestion.suggested_jobs.map(job => ({
        id: job.job_id,
        name: job.wo_no,
        job_number: job.wo_no,
        customer: job.customer,
        due_date: job.due_date,
        quantity: 1,
        pdf_url: '',
        file_name: job.wo_no + '.pdf',
        user_id: '', // Will be set by the batch creation hook
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'queued' as const
      }));

      const batchConfig = {
        ...productConfigs.BUSINESS_CARDS,
        laminationType: (suggestion.lamination_type || 'none') as any,
        slaTargetDays: 3,
        paperType: 'Standard',
        paperWeight: '350gsm'
      };

      const result = await createBatchWithSelectedJobs(batchJobs, batchConfig);
      
      if (result) {
        toast.success(`Batch created successfully with ${suggestion.suggested_jobs.length} jobs`);
        onBatchCreated();
        // Re-analyze after batch creation
        setTimeout(analyzeAllQueues, 1000);
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create batch');
    }
  };

  const getTotalPotentialSavings = () => {
    const allSuggestions = Object.values(suggestions).flat();
    return {
      materialSavings: allSuggestions.reduce((sum, s) => sum + s.material_savings, 0),
      timeSavings: allSuggestions.reduce((sum, s) => sum + s.time_savings_hours, 0),
      totalBatches: allSuggestions.length,
      totalJobs: allSuggestions.reduce((sum, s) => sum + s.suggested_jobs.length, 0)
    };
  };

  const potentialSavings = getTotalPotentialSavings();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Batch Optimization Engine</h3>
          <p className="text-sm text-muted-foreground">
            AI-powered batch recommendations for maximum efficiency
          </p>
        </div>
        <Button onClick={analyzeAllQueues} disabled={isAnalyzing} variant="outline">
          <Zap className="h-4 w-4 mr-2" />
          {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
        </Button>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-primary" />
              <div>
                <p className="text-2xl font-bold">{potentialSavings.totalBatches}</p>
                <p className="text-xs text-muted-foreground">Batch Opportunities</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-success" />
              <div>
                <p className="text-2xl font-bold">{potentialSavings.totalJobs}</p>
                <p className="text-xs text-muted-foreground">Jobs Ready to Batch</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-warning" />
              <div>
                <p className="text-2xl font-bold">{Math.round(potentialSavings.materialSavings)}%</p>
                <p className="text-xs text-muted-foreground">Material Savings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-info" />
              <div>
                <p className="text-2xl font-bold">{Math.round(potentialSavings.timeSavings)}h</p>
                <p className="text-xs text-muted-foreground">Time Savings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {selectedSuggestion && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span>Top Optimization Opportunity</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {selectedSuggestion.efficiency_score}%
                    </div>
                    <div className="text-sm text-muted-foreground">Efficiency Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {selectedSuggestion.material_savings}%
                    </div>
                    <div className="text-sm text-muted-foreground">Material Savings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-info">
                      {selectedSuggestion.time_savings_hours}h
                    </div>
                    <div className="text-sm text-muted-foreground">Time Savings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {selectedSuggestion.suggested_jobs.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Jobs</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Optimization Reasoning:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {selectedSuggestion.reasoning.map((reason, i) => (
                      <li key={i}>• {reason}</li>
                    ))}
                  </ul>
                </div>
                
                <Button 
                  onClick={() => handleCreateBatch(selectedSuggestion)}
                  disabled={isCreatingBatch}
                  className="w-full"
                >
                  {isCreatingBatch ? 'Creating Batch...' : 'Create Optimized Batch'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          {Object.entries(suggestions).map(([queueId, queueSuggestions]) => {
            const queue = queues.find(q => q.id === queueId);
            if (!queue) return null;
            
            return (
              <Card key={queueId}>
                <CardHeader>
                  <CardTitle>{queue.name} - {queueSuggestions.length} Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {queueSuggestions.map((suggestion, index) => (
                      <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedSuggestion(suggestion)}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">
                                Batch #{index + 1}
                              </Badge>
                              <Badge variant="outline">
                                {suggestion.efficiency_score}% efficient
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div className="text-center">
                                <div className="font-medium text-success">
                                  {suggestion.material_savings}%
                                </div>
                                <div className="text-xs text-muted-foreground">Material</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium text-primary">
                                  {suggestion.time_savings_hours}h
                                </div>
                                <div className="text-xs text-muted-foreground">Time</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium">
                                  {suggestion.suggested_jobs.length}
                                </div>
                                <div className="text-xs text-muted-foreground">Jobs</div>
                              </div>
                            </div>
                            
                            <Button 
                              size="sm" 
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateBatch(suggestion);
                              }}
                              disabled={isCreatingBatch}
                            >
                              Create Batch
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {Object.keys(suggestions).length === 0 && !isAnalyzing && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No batch optimization opportunities found. 
                Try adjusting queue priorities or adding more jobs.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          {selectedSuggestion && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Batch Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Jobs in Suggested Batch:</h4>
                  <div className="space-y-2">
                    {selectedSuggestion.suggested_jobs.map((job) => (
                      <div key={job.job_id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <div>
                          <div className="font-medium">{job.wo_no}</div>
                          <div className="text-sm text-muted-foreground">{job.customer}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            Priority: {Math.round(job.priority_score)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Due: {new Date(job.due_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Efficiency Breakdown:</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Material Optimization:</span>
                        <span>{selectedSuggestion.material_savings}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Setup Time Reduction:</span>
                        <span>{selectedSuggestion.time_savings_hours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Priority Alignment:</span>
                        <span>{selectedSuggestion.priority_alignment}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Batch Compatibility:</h4>
                    <Progress 
                      value={selectedSuggestion.efficiency_score} 
                      className="mb-2"
                    />
                    <p className="text-sm text-muted-foreground">
                      {selectedSuggestion.efficiency_score}% compatible for batching
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
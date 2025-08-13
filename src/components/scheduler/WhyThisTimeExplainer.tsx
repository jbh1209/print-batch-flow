import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

const WhyThisTimeExplainer = () => {
  const [jobId, setJobId] = useState('');
  const [explanation, setExplanation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const explainScheduling = async () => {
    if (!jobId.trim()) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('explain_job_scheduling', {
        p_job_id: jobId.trim(),
        p_job_table_name: 'production_jobs'
      });

      if (error) throw error;
      setExplanation(data);
    } catch (error) {
      console.error('Failed to explain scheduling:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🤔 "Why This Time?" - Scheduling Explanation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Enter Job ID (UUID)"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              />
              <Button onClick={explainScheduling} disabled={isLoading}>
                {isLoading ? 'Analyzing...' : 'Explain Schedule'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {explanation && (
          <div className="space-y-4">
            {explanation.map((stage: any, i: number) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge>{stage.stage_name}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {stage.scheduled_time || 'Not scheduled'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">{stage.explanation}</p>
                  {stage.decision_factors && Object.keys(stage.decision_factors).length > 0 && (
                    <details>
                      <summary className="cursor-pointer font-medium">Decision Factors</summary>
                      <pre className="text-xs bg-muted p-2 rounded mt-2">
                        {JSON.stringify(stage.decision_factors, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhyThisTimeExplainer;
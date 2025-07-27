import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { TimingCalculationService } from "@/services/timingCalculationService";

interface TimingRecalculationResult {
  stageInstanceId: string;
  stageId: string;
  stageName: string;
  oldDuration: number | null;
  newDuration: number;
  quantity: number | null;
  jobId: string;
  woNo: string;
}

interface TimingStats {
  totalStages: number;
  stagesWithTiming: number;
  stagesWithoutTiming: number;
  avgTimingPerStage: number;
}

export const BulkTimingRecalculation = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [results, setResults] = useState<TimingRecalculationResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [timingStats, setTimingStats] = useState<TimingStats | null>(null);

  const loadTimingStats = async () => {
    setIsLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          estimated_duration_minutes,
          quantity,
          production_stages(name)
        `)
        .neq('status', 'cancelled'); // Process all stages except cancelled ones

      if (error) throw error;

      const totalStages = data?.length || 0;
      const stagesWithTiming = data?.filter(s => s.estimated_duration_minutes && s.estimated_duration_minutes > 0).length || 0;
      const stagesWithoutTiming = totalStages - stagesWithTiming;
      const avgTimingPerStage = stagesWithTiming > 0 
        ? Math.round((data?.filter(s => s.estimated_duration_minutes).reduce((sum, s) => sum + (s.estimated_duration_minutes || 0), 0) || 0) / stagesWithTiming)
        : 0;

      setTimingStats({
        totalStages,
        stagesWithTiming,
        stagesWithoutTiming,
        avgTimingPerStage
      });
    } catch (error) {
      console.error('Error loading timing stats:', error);
      toast.error("Failed to load timing statistics");
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadTimingStats();
  }, []);

  const handleBulkTimingRecalculation = async () => {
    setIsRecalculating(true);
    setResults([]);
    
    try {
      // Get all active job stage instances that need timing recalculation
      const { data: stageInstances, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          stage_specification_id,
          quantity,
          estimated_duration_minutes,
          job_table_name,
          production_stages(id, name, running_speed_per_hour, make_ready_time_minutes, speed_unit)
        `)
        .neq('status', 'cancelled'); // Process all stages except cancelled ones

      if (fetchError) throw fetchError;

      if (!stageInstances || stageInstances.length === 0) {
        toast.info("No active stage instances found to recalculate");
        return;
      }

      const recalculationResults: TimingRecalculationResult[] = [];
      let updateCount = 0;

      // Process each stage instance
      for (const instance of stageInstances) {
        try {
          // Get job details for quantity if not available on stage instance
          let quantity = instance.quantity;
          let woNo = 'Unknown';
          
          if (!quantity || quantity <= 0) {
            // Only support production_jobs table for now due to TypeScript constraints
            if (instance.job_table_name === 'production_jobs' || !instance.job_table_name) {
              const { data: jobData } = await supabase
                .from('production_jobs')
                .select('qty, wo_no')
                .eq('id', instance.job_id)
                .single();
              
              quantity = jobData?.qty || 1;
              woNo = jobData?.wo_no || 'Unknown';
            } else {
              quantity = 1; // Default quantity for non-production jobs
            }
          } else {
            // Get WO number for display
            if (instance.job_table_name === 'production_jobs' || !instance.job_table_name) {
              const { data: jobData } = await supabase
                .from('production_jobs')
                .select('wo_no')
                .eq('id', instance.job_id)
                .single();
              
              woNo = jobData?.wo_no || 'Unknown';
            }
          }

          // Recalculate timing using the service with debug logging
          console.log(`🔧 Recalculating timing for stage ${(instance.production_stages as any)?.name || 'Unknown'} (${instance.id}) with quantity: ${quantity}, stageId: ${instance.production_stage_id}, specId: ${instance.stage_specification_id}`);
          
          const timingEstimate = await TimingCalculationService.calculateStageTimingWithInheritance({
            quantity,
            stageId: instance.production_stage_id,
            specificationId: instance.stage_specification_id
          });
          
          console.log(`🔧 Timing result for ${(instance.production_stages as any)?.name}: ${timingEstimate.estimatedDurationMinutes} minutes (source: ${timingEstimate.calculationSource})`);

          const oldDuration = instance.estimated_duration_minutes;
          const newDuration = timingEstimate.estimatedDurationMinutes;

          // Only update if timing has changed
          if (oldDuration !== newDuration) {
            const { error: updateError } = await supabase
              .from('job_stage_instances')
              .update({
                estimated_duration_minutes: newDuration,
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);

            if (!updateError) {
              updateCount++;
              recalculationResults.push({
                stageInstanceId: instance.id,
                stageId: instance.production_stage_id,
                stageName: (instance.production_stages as any)?.name || 'Unknown Stage',
                oldDuration,
                newDuration,
                quantity,
                jobId: instance.job_id,
                woNo
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to recalculate timing for stage instance ${instance.id}:`, error);
        }
      }

      setResults(recalculationResults);
      setShowResults(true);
      
      if (updateCount > 0) {
        toast.success(`Successfully recalculated timing for ${updateCount} stage instances`);
        // Refresh stats
        await loadTimingStats();
      } else {
        toast.info("No stage timings needed to be updated");
      }
    } catch (error) {
      console.error('Error during bulk timing recalculation:', error);
      toast.error("An error occurred during bulk timing recalculation");
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Bulk Stage Timing Recalculation
          </CardTitle>
          <CardDescription>
            Recalculate estimated duration for all active job stage instances based on updated production stage configurations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Current Statistics */}
            {isLoadingStats ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Loading timing statistics...</p>
              </div>
            ) : timingStats && (
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="font-medium text-blue-800">Total Active Stages</div>
                  <div className="text-2xl font-bold text-blue-600">{timingStats.totalStages}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="font-medium text-green-800">With Timing</div>
                  <div className="text-2xl font-bold text-green-600">{timingStats.stagesWithTiming}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="font-medium text-red-800">Without Timing</div>
                  <div className="text-2xl font-bold text-red-600">{timingStats.stagesWithoutTiming}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="font-medium text-purple-800">Avg Minutes</div>
                  <div className="text-2xl font-bold text-purple-600">{timingStats.avgTimingPerStage}</div>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Important Notes</h4>
                  <ul className="mt-2 text-sm text-amber-700 space-y-1">
                    <li>• This will recalculate estimated_duration_minutes for all job stage instances (except cancelled)</li>
                    <li>• Uses current production stage configurations and specifications</li>
                    <li>• Preserves existing quantities and part assignments</li>
                    <li>• Only updates stages where timing has actually changed</li>
                    <li>• Kanban time displays will update immediately after recalculation</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleBulkTimingRecalculation}
                disabled={isRecalculating}
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2" />
                {isRecalculating ? "Recalculating..." : "Recalculate All Stage Timings"}
              </Button>
              
              <Button 
                variant="outline"
                onClick={loadTimingStats}
                disabled={isLoadingStats}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showResults && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Timing Recalculation Results
            </CardTitle>
            <CardDescription>
              Summary of {results.length} stage instances with updated timing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="font-medium text-blue-800">Stages Updated</div>
                  <div className="text-2xl font-bold text-blue-600">{results.length}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="font-medium text-green-800">Avg New Duration</div>
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(results.reduce((sum, r) => sum + r.newDuration, 0) / results.length)}m
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="font-medium text-orange-800">Total Time Added</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(results.reduce((sum, r) => sum + (r.newDuration - (r.oldDuration || 0)), 0) / 60)}h
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                All stage instances now have accurate timing based on current production configurations.
                Kanban columns will display updated total times immediately.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
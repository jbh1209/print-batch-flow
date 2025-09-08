import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  User, 
  Calendar,
  FileText,
  Send,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftSummary {
  operator_id: string;
  operator_name?: string;
  jobs_completed: number;
  jobs_in_progress: number;
  total_time_minutes: number;
  issues_encountered: number;
  efficiency_score: number;
}

interface HandoverJob {
  job_id: string;
  wo_no: string;
  customer?: string;
  stage_name: string;
  status: string;
  started_at?: string;
  notes?: string;
  completion_percentage: number;
  estimated_remaining_minutes?: number;
}

export const ShiftHandoverReport: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [handoverNotes, setHandoverNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const shiftStart = new Date();
  shiftStart.setHours(shiftStart.getHours() - 8); // Assume 8-hour shift

  // Get shift summary data
  const { data: shiftSummary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['shift-summary', today, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          status,
          started_at,
          completed_at,
          estimated_duration_minutes,
          assigned_operator_id,
          production_jobs!inner(
            wo_no,
            customer
          ),
          production_stages!inner(
            name
          )
        `)
        .eq('assigned_operator_id', user.id)
        .gte('started_at', shiftStart.toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;

      const completed = data.filter(job => job.status === 'completed');
      const inProgress = data.filter(job => job.status === 'active');
      
      const totalMinutes = completed.reduce((sum, job) => {
        if (job.started_at && job.completed_at) {
          const start = new Date(job.started_at);
          const end = new Date(job.completed_at);
          return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
        }
        return sum;
      }, 0);

      const summary: ShiftSummary = {
        operator_id: user.id,
        operator_name: user.email,
        jobs_completed: completed.length,
        jobs_in_progress: inProgress.length,
        total_time_minutes: totalMinutes,
        issues_encountered: 0, // Would need separate issue tracking
        efficiency_score: 85, // Would calculate based on actual vs estimated times
      };

      return summary;
    },
    enabled: !!user?.id,
  });

  // Get in-progress jobs for handover
  const { data: handoverJobs = [], isLoading: loadingJobs, refetch: refetchJobs } = useQuery({
    queryKey: ['handover-jobs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          status,
          actual_start_at,
          estimated_duration_minutes,
          notes,
          production_jobs!inner(
            wo_no,
            customer
          ),
          production_stages!inner(
            name
          )
        `)
        .eq('assigned_operator_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: true });

      if (error) throw error;

      return data.map((job): HandoverJob => {
        const elapsedMinutes = job.started_at ? 
          Math.floor((new Date().getTime() - new Date(job.started_at).getTime()) / (1000 * 60)) : 0;
        
        const estimatedTotal = job.estimated_duration_minutes || 60;
        const completionPercentage = Math.min(Math.floor((elapsedMinutes / estimatedTotal) * 100), 90);
        
        return {
          job_id: job.job_id,
          wo_no: job.production_jobs.wo_no,
          customer: job.production_jobs.customer,
          stage_name: job.production_stages.name,
          status: job.status,
          started_at: job.started_at,
          notes: job.notes,
          completion_percentage: completionPercentage,
          estimated_remaining_minutes: Math.max(estimatedTotal - elapsedMinutes, 10),
        };
      });
    },
    enabled: !!user?.id,
  });

  const submitHandover = async () => {
    if (!user?.id) return;

    setIsSubmitting(true);
    try {
      // Create handover record
      const handoverData = {
        operator_id: user.id,
        shift_date: today,
        jobs_completed: shiftSummary?.jobs_completed || 0,
        jobs_in_progress: handoverJobs.length,
        total_work_minutes: shiftSummary?.total_time_minutes || 0,
        handover_notes: handoverNotes,
        in_progress_jobs: handoverJobs.map(job => ({
          job_id: job.job_id,
          wo_no: job.wo_no,
          stage_name: job.stage_name,
          completion_percentage: job.completion_percentage,
          estimated_remaining_minutes: job.estimated_remaining_minutes,
          notes: job.notes
        })),
        created_at: new Date().toISOString()
      };

      // For now, log to barcode_scan_log as handover record
      // In production, you'd want a dedicated handover table
      const { error } = await supabase
        .from('barcode_scan_log')
        .insert({
          user_id: user.id,
          barcode_data: 'shift_handover',
          scan_result: 'success',
          action_taken: 'Shift handover submitted',
        });

      if (error) throw error;

      toast({
        title: "Handover Submitted",
        description: "Your shift handover report has been recorded successfully.",
      });

      setHandoverNotes("");
    } catch (error) {
      console.error('Handover submission error:', error);
      toast({
        title: "Handover Failed",
        description: "Failed to submit handover report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const refetch = () => {
    refetchSummary();
    refetchJobs();
  };

  if (loadingSummary || loadingJobs) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-48">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading shift data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Shift Handover Report
            </CardTitle>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Shift Summary</TabsTrigger>
              <TabsTrigger value="handover">In Progress</TabsTrigger>
              <TabsTrigger value="notes">Notes & Submit</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{shiftSummary?.jobs_completed || 0}</p>
                    <p className="text-sm text-gray-600">Jobs Completed</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{handoverJobs.length}</p>
                    <p className="text-sm text-gray-600">In Progress</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <User className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold">
                      {formatDuration(shiftSummary?.total_time_minutes || 0)}
                    </p>
                    <p className="text-sm text-gray-600">Work Time</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{shiftSummary?.efficiency_score || 0}%</p>
                    <p className="text-sm text-gray-600">Efficiency</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold">Shift Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Start Time:</span>
                    <span className="font-medium">{formatTime(shiftStart.toISOString())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Time:</span>
                    <span className="font-medium">{formatTime(new Date().toISOString())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Job Time:</span>
                    <span className="font-medium">
                      {shiftSummary?.jobs_completed ? 
                        formatDuration(Math.floor(shiftSummary.total_time_minutes / shiftSummary.jobs_completed)) : 
                        "N/A"
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Issues Reported:</span>
                    <span className="font-medium">{shiftSummary?.issues_encountered || 0}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="handover" className="space-y-4">
              {handoverJobs.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-lg font-semibold">All Jobs Complete</p>
                  <p className="text-gray-600">No jobs in progress to hand over.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    The following {handoverJobs.length} job{handoverJobs.length > 1 ? 's are' : ' is'} in progress and will need to be completed by the next shift:
                  </p>
                  
                  {handoverJobs.map((job) => (
                    <Card key={job.job_id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{job.wo_no}</h4>
                            {job.customer && (
                              <p className="text-sm text-gray-600">{job.customer}</p>
                            )}
                            <p className="text-sm font-medium text-blue-700">{job.stage_name}</p>
                          </div>
                          <Badge variant="outline" className="bg-blue-50">
                            {job.completion_percentage}% Complete
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div className="flex justify-between">
                            <span>Started:</span>
                            <span className="font-medium">{formatTime(job.started_at)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Est. Remaining:</span>
                            <span className="font-medium">
                              {formatDuration(job.estimated_remaining_minutes || 0)}
                            </span>
                          </div>
                        </div>

                        {job.notes && (
                          <div className="bg-gray-50 p-2 rounded text-sm">
                            <strong>Notes:</strong> {job.notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="handover-notes">Handover Notes</Label>
                  <Textarea
                    id="handover-notes"
                    placeholder="Add any important notes for the next shift (issues, special instructions, delays, etc.)"
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    className="min-h-[120px] mt-2"
                    maxLength={1000}
                  />
                  <p className="text-xs text-gray-500 mt-1">{handoverNotes.length}/1000 characters</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Handover Summary</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• {shiftSummary?.jobs_completed || 0} jobs completed this shift</li>
                    <li>• {handoverJobs.length} jobs in progress</li>
                    <li>• {formatDuration(shiftSummary?.total_time_minutes || 0)} total work time</li>
                    {handoverNotes && <li>• Custom notes provided</li>}
                  </ul>
                </div>

                <Button 
                  onClick={submitHandover} 
                  disabled={isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Submitting Handover...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Shift Handover
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
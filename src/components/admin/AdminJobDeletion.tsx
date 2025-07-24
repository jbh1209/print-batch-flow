import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Trash2 } from "lucide-react";

const AdminJobDeletion = () => {
  const [jobId, setJobId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleForceDelete = async () => {
    if (!jobId.trim()) {
      toast.error("Please enter a job ID");
      return;
    }

    setIsDeleting(true);
    try {
      // Delete from job_stage_instances first (foreign key dependency)
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', jobId);

      if (stageError) {
        console.error("Stage deletion error:", stageError);
      }

      // Delete from batch_job_references
      const { error: batchRefError } = await supabase
        .from('batch_job_references')
        .delete()
        .eq('production_job_id', jobId);

      if (batchRefError) {
        console.error("Batch ref deletion error:", batchRefError);
      }

      // Delete from production_jobs
      const { error: prodError } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (prodError) {
        console.error("Production job deletion error:", prodError);
        toast.error(`Failed to delete production job: ${prodError.message}`);
        return;
      }

      toast.success(`Successfully force deleted job ${jobId}`);
      setJobId("");
    } catch (error) {
      console.error("Force deletion failed:", error);
      toast.error("Force deletion failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllBatchJobs = async () => {
    setIsDeleting(true);
    try {
      // Get all batch master jobs
      const { data: batchJobs, error: fetchError } = await supabase
        .from('production_jobs')
        .select('id')
        .eq('is_batch_master', true);

      if (fetchError) {
        toast.error(`Failed to fetch batch jobs: ${fetchError.message}`);
        return;
      }

      if (!batchJobs || batchJobs.length === 0) {
        toast.info("No batch jobs found");
        return;
      }

      const jobIds = batchJobs.map(job => job.id);

      // Delete job stage instances for all batch jobs
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .delete()
        .in('job_id', jobIds);

      if (stageError) {
        console.error("Stage deletion error:", stageError);
      }

      // Delete batch job references
      const { error: batchRefError } = await supabase
        .from('batch_job_references')
        .delete()
        .in('production_job_id', jobIds);

      if (batchRefError) {
        console.error("Batch ref deletion error:", batchRefError);
      }

      // Delete the batch master jobs
      const { error: prodError } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', jobIds);

      if (prodError) {
        toast.error(`Failed to delete batch jobs: ${prodError.message}`);
        return;
      }

      toast.success(`Successfully deleted ${jobIds.length} batch jobs`);
    } catch (error) {
      console.error("Batch deletion failed:", error);
      toast.error("Batch deletion failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Admin Job Deletion Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Force Delete Single Job</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter job ID (e.g., D425088)"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={isDeleting}
              />
              <Button
                onClick={handleForceDelete}
                disabled={isDeleting || !jobId.trim()}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Force Delete
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Delete All Batch Jobs</label>
            <Button
              onClick={handleDeleteAllBatchJobs}
              disabled={isDeleting}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Batch Master Jobs
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            <strong>Warning:</strong> This tool bypasses normal deletion checks and will force delete jobs and their dependencies.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminJobDeletion;
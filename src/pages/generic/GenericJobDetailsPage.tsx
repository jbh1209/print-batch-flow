import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProductConfig, BaseJob, JobStatus } from "@/config/productTypes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/dateUtils";
import { Badge } from "@/components/ui/badge";
import { canModifyRecord } from "@/utils/permissionUtils";
import { Edit, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GenericJobDetailsPageProps {
  config: ProductConfig;
}

const GenericJobDetailsPage: React.FC<GenericJobDetailsPageProps> = ({ config }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<BaseJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) {
        setError("Job ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from(config.tableName as string)
          .select("*")
          .eq("id", jobId)
          .single();

        if (error) {
          console.error("Error fetching job details:", error);
          setError("Failed to load job details.");
          return;
        }

        if (!data) {
          setError("Job not found.");
          return;
        }

        setJob(data as BaseJob);
      } catch (err) {
        console.error("Error fetching job details:", err);
        setError("Failed to load job details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
  }, [jobId, config.tableName]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Job Not Found</AlertTitle>
        <AlertDescription>
          {error || "The requested job could not be found."}
          <div className="mt-2">
            <Button
              variant="outline"
              onClick={() => navigate(config.routes.jobsPath || "/")}
            >
              Back to Jobs
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const canModify = canModifyRecord(job.user_id, user?.id);

  const handleEdit = () => {
    navigate(config.routes.jobEditPath ? config.routes.jobEditPath(job.id) : `/jobs/${job.id}/edit`);
  };

  const status = job.status as JobStatus;

  return (
    <div>
      <div className="flex items-center mb-6">
        <Button
          variant="outline"
          size="sm"
          className="mr-4"
          onClick={() => navigate(config.routes.jobsPath || "/")}
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Jobs
        </Button>
        <h2 className="text-xl font-semibold">
          {config.ui.jobFormTitle} Details
        </h2>
      </div>

      <div className="max-w-2xl bg-white p-6 rounded-lg shadow">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{job.name}</h3>
          <div className="text-sm text-gray-500">{job.job_number}</div>
          {!canModify && (
            <Badge variant="outline" className="mt-1 text-xs">
              Read-only
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <strong>Status:</strong>
            <Badge variant="secondary">{status}</Badge>
          </div>
          <div>
            <strong>Quantity:</strong> {job.quantity}
          </div>
          <div>
            <strong>Due Date:</strong> {formatDate(job.due_date)}
          </div>
          <div>
            <strong>Created At:</strong> {formatDate(job.created_at)}
          </div>
          {job.paper_type && (
            <div>
              <strong>Paper Type:</strong> {job.paper_type}
            </div>
          )}
          {job.paper_weight && (
            <div>
              <strong>Paper Weight:</strong> {job.paper_weight}
            </div>
          )}
          {job.size && (
            <div>
              <strong>Size:</strong> {job.size}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate(job.pdf_url || "")} disabled={!job.pdf_url}>
            View PDF
          </Button>
          {canModify && (
            <Button onClick={handleEdit}>
              <Edit size={16} className="mr-2" />
              Edit Job
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenericJobDetailsPage;

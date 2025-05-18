import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Download } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import { canModifyRecord } from "@/utils/permissionUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Link } from "react-router-dom";
import { formatDate } from "@/utils/dateUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { useToast } from "@/components/ui/use-toast"
import { ProductConfig, BaseJob } from '@/config/productTypes';

interface GenericJobDetailsPageProps {
  config: ProductConfig;
  useJob: (id: string) => { job: BaseJob | undefined, isLoading: boolean, error: any, onDelete: (id: string) => Promise<boolean> };
}

const GenericJobDetailsPage: React.FC<GenericJobDetailsPageProps> = ({ config, useJob }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { job, isLoading, error, onDelete } = useJob(id!);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast()

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load job. Please try again.",
      })
    }
  }, [error, toast]);

  if (isLoading || !id) {
    return <div>Loading...</div>;
  }

  if (!job) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Not found</AlertTitle>
        <AlertDescription>
          This job could not be found.
        </AlertDescription>
      </Alert>
    );
  }

  const canModify = canModifyRecord(job.user_id, user?.id);

  const handleDelete = async () => {
    const success = await onDelete(id!);
    if (success) {
      toast({
        title: "Success",
        description: "Job deleted successfully.",
      })
      navigate(config.routes.jobsPath || config.routes.basePath);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete job. Please try again.",
      })
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{job.name}</h1>
        <div>
          <Link to={config.routes.jobsPath || config.routes.basePath}>
            <Button variant="secondary" className="mr-2">
              Back to Jobs
            </Button>
          </Link>
          {canModify && (
            <Link to={config.routes.jobEditPath ? config.routes.jobEditPath(id!) : '#'}>
              <Button variant="outline" className="mr-2">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          {job.pdf_url && (
            <Button variant="outline" asChild>
              <a href={job.pdf_url} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-gray-700 font-medium">Job Number:</span>
                <p>{job.job_number}</p>
              </div>
              <div>
                <span className="text-gray-700 font-medium">Status:</span>
                <p>{job.status}</p>
              </div>
              <div>
                <span className="text-gray-700 font-medium">Quantity:</span>
                <p>{job.quantity}</p>
              </div>
              <div>
                <span className="text-gray-700 font-medium">Due Date:</span>
                <p>{formatDate(job.due_date)}</p>
              </div>
              <div>
                <span className="text-gray-700 font-medium">Created At:</span>
                <p>{formatDate(job.created_at)}</p>
              </div>
              {/* Add more job details here based on your job object */}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {canModify ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Job
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete this job from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <p>You do not have permission to modify this job.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GenericJobDetailsPage;

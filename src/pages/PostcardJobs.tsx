
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePostcardJobs } from "@/hooks/usePostcardJobs";
import { PostcardJobsTable } from "@/components/postcards/PostcardJobsTable";

const PostcardJobs = () => {
  const navigate = useNavigate();
  const {
    jobs,
    isLoading,
    error,
    fetchJobs,
    handleViewJob,
    handleDeleteJob
  } = usePostcardJobs();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Postcard Jobs</h1>
          <p className="text-gray-500 mt-1">Manage your postcard print jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={() => navigate("/batches/postcards")}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </Button>
          <Button onClick={() => navigate("/batches/postcards/jobs/new")}>
            <Plus size={16} className="mr-1" />
            Add New Job
          </Button>
        </div>
      </div>

      {error && !isLoading && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PostcardJobsTable
        jobs={jobs}
        isLoading={isLoading}
        error={error}
        onViewJob={handleViewJob}
        onDeleteJob={handleDeleteJob}
        onRefresh={fetchJobs}
      />
    </div>
  );
};

export default PostcardJobs;

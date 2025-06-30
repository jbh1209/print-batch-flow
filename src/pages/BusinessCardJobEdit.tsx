
import { useNavigate, useParams } from "react-router-dom";
import { useBusinessCardJob } from "@/hooks/useBusinessCardJob";
import JobFormHeader from "@/components/business-cards/JobFormHeader";
import JobEditForm from "@/components/business-cards/JobEditForm";
import JobErrorDisplay from "@/components/business-cards/JobErrorDisplay";
import FormLoadingSpinner from "@/components/business-cards/FormLoadingSpinner";

const BusinessCardJobEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoading, isSaving, error, jobData, updateJob } = useBusinessCardJob(id);

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl">
        <JobFormHeader isEditing={true} />
        <JobErrorDisplay error={error} />
      </div>
    );
  }

  // Ensure jobData has required properties for the form
  const formJobData = jobData ? {
    ...jobData,
    lamination_type: jobData.lamination_type || 'none',
    paper_type: jobData.paper_type || 'Standard'
  } : null;

  return (
    <div className="container mx-auto max-w-4xl">
      <JobFormHeader isEditing={true} />

      <div className="bg-white rounded-lg border shadow p-6">
        {isLoading ? (
          <FormLoadingSpinner />
        ) : (
          <JobEditForm
            jobData={formJobData}
            isSaving={isSaving}
            onSubmit={updateJob}
          />
        )}
      </div>
    </div>
  );
};

export default BusinessCardJobEdit;

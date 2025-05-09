
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBusinessCardJob } from "@/hooks/useBusinessCardJob";
import JobEditForm from "@/components/business-cards/JobEditForm";
import JobFormHeader from "@/components/business-cards/JobFormHeader";
import JobErrorDisplay from "@/components/business-cards/JobErrorDisplay";
import FormLoadingSpinner from "@/components/business-cards/FormLoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";

const BusinessCardJobEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formSuccess, setFormSuccess] = useState(false);
  const { isLoading, error, jobData, isSaving, updateJob } = useBusinessCardJob(id);

  const handleFormSubmit = async (formData: any, selectedFile: File | null) => {
    const success = await updateJob(formData, selectedFile);
    setFormSuccess(success);
    
    if (success) {
      // Navigate after a short delay
      setTimeout(() => {
        navigate('/batches/business-cards/jobs');
      }, 2000);
    }
    
    return success;
  };

  if (isLoading) {
    return <FormLoadingSpinner message="Loading job details..." />;
  }

  if (error || !jobData) {
    return <JobErrorDisplay error={error || "Job not found"} />;
  }

  return (
    <div className="container mx-auto py-6">
      <Card className="max-w-3xl mx-auto">
        <CardContent className="pt-6">
          <JobFormHeader 
            title="Edit Business Card Job"
            description="Update the details for this business card job."
          />
          <JobEditForm
            initialData={{
              name: jobData.name,
              quantity: jobData.quantity,
              doubleSided: jobData.double_sided,
              laminationType: jobData.lamination_type,
              paperType: jobData.paper_type,
              dueDate: new Date(jobData.due_date),
              fileUrl: jobData.pdf_url,
              fileName: jobData.file_name
            }}
            onSubmit={handleFormSubmit}
            isSubmitting={isSaving}
            success={formSuccess}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessCardJobEdit;

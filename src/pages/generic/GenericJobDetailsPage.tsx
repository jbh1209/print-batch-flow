
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProductConfig } from "@/config/types/productConfigTypes";

interface GenericJobDetailsPageProps {
  productType: string;
}

const GenericJobDetailsPage: React.FC<GenericJobDetailsPageProps> = ({ productType }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  
  const goBack = () => {
    navigate(`/batches/${productType.toLowerCase().replace(' ', '-')}/jobs`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{productType} Job Details</h1>
          <p className="text-gray-500 mt-1">View details for job ID: {jobId}</p>
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-1"
          onClick={goBack}
        >
          <ArrowLeft size={16} />
          Back to Jobs
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <p>Viewing job details for {productType} job ID: {jobId}</p>
          
          {/* This is a placeholder. In a real implementation, we would fetch and display job details */}
          <div className="mt-4 grid gap-4">
            <div>
              <h3 className="font-medium">Job Details</h3>
              <p className="text-sm text-gray-500">Details would be displayed here based on job ID</p>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/batches/${productType.toLowerCase().replace(' ', '-')}/jobs/${jobId}/edit`)}
              >
                Edit Job
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GenericJobDetailsPage;

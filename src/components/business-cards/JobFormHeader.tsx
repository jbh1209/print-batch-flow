
import { CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface JobFormHeaderProps {
  isEditing?: boolean;
}

const JobFormHeader = ({ isEditing = false }: JobFormHeaderProps) => {
  const navigate = useNavigate();
  
  const title = isEditing ? "Edit Business Card Job" : "Add New Business Card Job";
  const subtitle = isEditing 
    ? "Update the details of your business card job"
    : "Create a new business card job";
  
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <div className="flex items-center">
          <CreditCard className="h-6 w-6 mr-2 text-batchflow-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="text-gray-500 mt-1">{subtitle}</p>
      </div>
      <Button 
        variant="outline" 
        onClick={() => navigate("/batches/business-cards/jobs")}
        className="flex items-center gap-1"
      >
        <ArrowLeft size={16} />
        <span>Back to Jobs</span>
      </Button>
    </div>
  );
};

export default JobFormHeader;

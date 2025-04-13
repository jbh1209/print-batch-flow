
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface JobsHeaderProps {
  title: string;
  subtitle: string;
}

const JobsHeader = ({ title, subtitle }: JobsHeaderProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <div className="flex items-center">
          <CreditCard className="h-6 w-6 mr-2 text-batchflow-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="text-gray-500 mt-1">
          {subtitle}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={() => navigate("/batches/business-cards")}
        >
          <ArrowLeft size={16} />
          <span>Back to Business Cards</span>
        </Button>
        <Button className="flex items-center gap-1" onClick={() => navigate("/batches/business-cards/jobs/new")}>
          <Plus size={16} />
          <span>Add New Job</span>
        </Button>
      </div>
    </div>
  );
};

export default JobsHeader;

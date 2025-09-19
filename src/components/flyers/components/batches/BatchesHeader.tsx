
import { useNavigate } from "react-router-dom";
import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const BatchesHeader = () => {
  const navigate = useNavigate();
  
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <div className="flex items-center">
          <FileText className="h-6 w-6 mr-2 text-printstream-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Flyer Batches</h1>
        </div>
        <p className="text-gray-500 mt-1">View and manage all your flyer batches</p>
      </div>
      <Button 
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => navigate("/batches/flyers")}
      >
        <ArrowLeft size={16} />
        <span>Back to Flyers</span>
      </Button>
    </div>
  );
};

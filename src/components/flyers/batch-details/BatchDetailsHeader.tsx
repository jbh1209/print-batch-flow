
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";

interface BatchDetailsHeaderProps {
  batchName: string;
  onDeleteClick: () => void;
}

const BatchDetailsHeader = ({ batchName, onDeleteClick }: BatchDetailsHeaderProps) => {
  const navigate = useNavigate();
  
  const handleBackClick = () => {
    try {
      navigate("/printstream/batches/flyers");
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback navigation
      navigate("/printstream/batches/flyers");
    }
  };
  
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center">
        <Button 
          variant="outline" 
          size="sm" 
          className="mr-4"
          onClick={handleBackClick}
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Batches
        </Button>
        <h2 className="text-2xl font-semibold">Batch: {batchName}</h2>
      </div>
      
      <Button 
        variant="destructive" 
        size="sm"
        onClick={onDeleteClick}
      >
        <Trash2 className="h-4 w-4 mr-2" /> Delete Batch
      </Button>
    </div>
  );
};

export default BatchDetailsHeader;

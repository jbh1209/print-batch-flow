
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const EmptyBatchState = () => {
  const navigate = useNavigate();
  
  return (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
      <p className="text-gray-500 mb-6">The batch you're looking for doesn't exist or has been deleted.</p>
      <Button onClick={() => navigate('/batches/flyers/batches')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Batches
      </Button>
    </div>
  );
};

export default EmptyBatchState;

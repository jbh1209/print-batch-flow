
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

const AllBatches = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Layers className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">All Batches</h1>
          </div>
          <p className="text-gray-500 mt-1">View and manage all print batches across different product types</p>
        </div>
        <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">No Active Batches</h2>
        <p className="text-gray-500 mb-4">There are currently no active batches in the system.</p>
        <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
      </div>
    </div>
  );
};

export default AllBatches;

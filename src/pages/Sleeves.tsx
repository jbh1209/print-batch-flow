
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

const Sleeves = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Package className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Shipper Box Sleeves</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage shipper box sleeve batches and jobs</p>
        </div>
        <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Shipper Box Sleeves Management</h2>
        <p className="text-gray-500 mb-4">This feature will be implemented soon.</p>
      </div>
    </div>
  );
};

export default Sleeves;


import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, Plus } from "lucide-react";
import { productConfigs } from "@/config/productTypes";

const Sleeves = () => {
  const navigate = useNavigate();
  const config = productConfigs["Sleeves"];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Package className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Shipper Box Sleeves</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage sleeve batches and jobs</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
          <Button onClick={() => navigate(config.routes.jobsPath)}>
            <Plus className="mr-2 h-4 w-4" />
            View Jobs
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex gap-4">
            <Button onClick={() => navigate(config.routes.newJobPath)}>
              Create New Job
            </Button>
            <Button variant="outline" onClick={() => navigate(config.routes.batchesPath)}>
              View Batches
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sleeves;

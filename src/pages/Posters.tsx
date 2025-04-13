
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";

const Posters = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Image className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Posters</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage poster batches and jobs</p>
        </div>
        <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Posters Management</h2>
        <p className="text-gray-500 mb-4">This feature will be implemented soon.</p>
      </div>
    </div>
  );
};

export default Posters;

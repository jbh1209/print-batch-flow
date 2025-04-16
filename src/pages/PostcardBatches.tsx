
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PostcardBatches = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Postcard Batches</h1>
          <p className="text-gray-500 mt-1">Manage your postcard print batches</p>
        </div>
        <Button 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={() => navigate("/batches/postcards")}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Postcard Batches</h2>
        <p className="text-gray-500 mb-4">No batches found. Create jobs first to generate batches.</p>
        <Button onClick={() => navigate("/batches/postcards/jobs/new")}>Create New Job</Button>
      </div>
    </div>
  );
};

export default PostcardBatches;

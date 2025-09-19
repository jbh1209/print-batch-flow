
import React from "react";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AllBatchesHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <div className="flex items-center">
          <Layers className="h-6 w-6 mr-2 text-printstream-primary" />
          <h1 className="text-2xl font-bold tracking-tight">All Batches</h1>
        </div>
        <p className="text-gray-500 mt-1">View and manage all print batches across different product types</p>
      </div>
      <Button onClick={() => navigate("/")} variant="outline" className="flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>
    </div>
  );
};

export default AllBatchesHeader;


import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BatchNotFoundProps {
  backUrl: string;
}

const BatchNotFound = ({ backUrl }: BatchNotFoundProps) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
      <p className="text-gray-500 mb-4">The requested batch could not be found or you don't have permission to view it.</p>
      <Button onClick={() => navigate(backUrl)}>Go Back</Button>
    </div>
  );
};

export default BatchNotFound;

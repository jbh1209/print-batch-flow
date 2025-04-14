
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface BatchDetailsHeaderProps {
  backUrl: string;
  error: string | null;
}

const BatchDetailsHeader = ({ backUrl, error }: BatchDetailsHeaderProps) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <Button
          onClick={() => navigate(backUrl)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Batches
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>{error}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default BatchDetailsHeader;

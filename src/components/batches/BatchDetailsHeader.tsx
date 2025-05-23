
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BatchDetailsHeaderProps {
  backUrl: string;
  error?: string | null;
  batchName?: string;
  productType?: string;
}

const BatchDetailsHeader = ({ backUrl, error, batchName, productType }: BatchDetailsHeaderProps) => {
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
          Back to {productType || 'All'} Batches
        </Button>
        
        {batchName && (
          <h1 className="text-2xl font-bold ml-4">{batchName}</h1>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
};

export default BatchDetailsHeader;


import React from "react";
import { Loader2 } from "lucide-react";

const BatchDetailsLoading = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin mb-4 text-gray-400" />
      <p>Loading batch details...</p>
    </div>
  );
};

export default BatchDetailsLoading;


import React from "react";
import { Loader2 } from "lucide-react";

const BatchesLoading = () => {
  return (
    <div className="bg-white rounded-lg shadow p-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
      <p>Loading batches...</p>
    </div>
  );
};

export default BatchesLoading;

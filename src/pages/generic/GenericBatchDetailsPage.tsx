
import React from "react";
import { useParams } from "react-router-dom";
import { ProductConfig } from "@/config/productTypes";
import GenericBatchDetails from "@/components/generic/GenericBatchDetails";

export interface GenericBatchDetailsPageProps {
  config: ProductConfig;
}

const GenericBatchDetailsPage: React.FC<GenericBatchDetailsPageProps> = ({ config }) => {
  const { id } = useParams<{ id: string }>();
  
  if (!id) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">No Batch Selected</h2>
        <p className="text-gray-500">Please select a batch to view its details.</p>
      </div>
    );
  }

  return <GenericBatchDetails batchId={id} config={config} />;
};

export default GenericBatchDetailsPage;

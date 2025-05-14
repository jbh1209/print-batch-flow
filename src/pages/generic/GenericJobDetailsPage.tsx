import React from "react";
import { useParams } from "react-router-dom";
import { ProductConfig } from "@/config/productTypes";

export interface GenericJobDetailsPageProps {
  config: ProductConfig;
}

const GenericJobDetailsPage: React.FC<GenericJobDetailsPageProps> = ({ config }) => {
  const { id } = useParams<{ id: string }>();
  
  if (!id) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">No Job Selected</h2>
        <p className="text-gray-500">Please select a job to view its details.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Job Details for {config.ui.title} {id}</h1>
      {/* Job details content here */}
    </div>
  );
};

export default GenericJobDetailsPage;

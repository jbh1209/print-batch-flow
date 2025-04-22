
import React from "react";
import { productConfigs } from "@/config/productTypes";
import { GenericJobForm } from "@/components/generic/GenericJobForm";

const FlyerJobNewPage = () => {
  const config = productConfigs["Flyers"];
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New {config.ui.jobFormTitle}</h1>
          <p className="text-gray-500 mt-1">Create a new {config.ui.jobFormTitle.toLowerCase()}</p>
        </div>
      </div>

      <GenericJobForm config={config} />
    </div>
  );
};

export default FlyerJobNewPage;

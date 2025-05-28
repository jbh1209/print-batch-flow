
import React from "react";
import { FlyerJobForm } from "@/components/flyers/FlyerJobForm";

const FlyerJobNewPage = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Flyer Job</h1>
          <p className="text-gray-500 mt-1">Create a new flyer printing job</p>
        </div>
      </div>

      <FlyerJobForm mode="create" />
    </div>
  );
};

export default FlyerJobNewPage;

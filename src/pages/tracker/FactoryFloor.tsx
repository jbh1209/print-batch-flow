
import React from "react";
import { UniversalFactoryFloor } from "@/components/tracker/factory/UniversalFactoryFloor";
import { ProductionDataProvider } from "@/contexts/ProductionDataContext";

/**
 * Factory Floor page component
 * 
 * Universal view that displays relevant job stages based on user permissions.
 * Dynamically shows columns for stages where the user can work.
 */
const FactoryFloor = () => {
  return (
    <ProductionDataProvider>
      <div className="min-h-screen bg-gray-50 w-full">
        <UniversalFactoryFloor />
      </div>
    </ProductionDataProvider>
  );
};

export default FactoryFloor;


import React from "react";
import { SimpleFactoryFloor } from "@/components/tracker/factory/SimpleFactoryFloor";

/**
 * Factory Floor page component - Simplified Version
 * 
 * Shows jobs organized by stage with simple, predictable actions.
 * No auto-advancement, clear manual control.
 */
const FactoryFloor = () => {
  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <SimpleFactoryFloor />
    </div>
  );
};

export default FactoryFloor;

import React from "react";
import { UniversalFactoryFloor } from "@/components/tracker/factory/UniversalFactoryFloor";

const FactoryFloor = () => {
  console.debug('FactoryFloor: Rendering standard operator view');
  
  // Always show standard factory floor for all operators
  return <UniversalFactoryFloor />;
};

export default FactoryFloor;

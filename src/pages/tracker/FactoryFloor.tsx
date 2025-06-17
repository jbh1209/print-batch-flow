
import React from "react";
import { SimplifiedFactoryFloor } from "@/components/tracker/factory/SimplifiedFactoryFloor";

/**
 * Simplified Factory Floor page component
 * 
 * Clean, direct approach that relies on the database function 
 * for all permission logic and job filtering.
 */
const FactoryFloor = () => {
  return <SimplifiedFactoryFloor />;
};

export default FactoryFloor;

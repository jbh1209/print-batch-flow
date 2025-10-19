import React, { useMemo } from "react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DieCuttingKanbanView } from "@/components/tracker/factory/DieCuttingKanbanView";
import { UniversalFactoryFloor } from "@/components/tracker/factory/UniversalFactoryFloor";

const FactoryFloor = () => {
  console.debug('FactoryFloor: Rendering standard operator view');
  
  // Always show standard factory floor for all operators
  return <UniversalFactoryFloor />;
};

export default FactoryFloor;

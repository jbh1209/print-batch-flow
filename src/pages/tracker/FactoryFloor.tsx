import React, { useMemo } from "react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DieCuttingKanbanView } from "@/components/tracker/factory/DieCuttingKanbanView";
import { UniversalFactoryFloor } from "@/components/tracker/factory/UniversalFactoryFloor";

const FactoryFloor = () => {
  const { user } = useAuth();
  const { isAdmin, isManager, accessibleStages, isLoading: roleLoading } = useUserRole();

  // Check if user is in Management or Die Cutting groups
  const { data: userGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["user-groups", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_group_memberships")
        .select(`
          user_groups!inner(
            name,
            description
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Determine if user should see die cutting view
  const shouldShowDieCuttingView = useMemo(() => {
    if (isAdmin || isManager) return true;

    // Check if user is in Management or Die Cutting groups
    const groupNames = userGroups?.map((g) => g.user_groups?.name?.toLowerCase() || "") || [];
    const isInManagement = groupNames.some((name) => 
      name.includes("management") || name.includes("die cutting")
    );

    if (isInManagement) return true;

    // Check if user has die cutting stage access
    const hasDieCuttingAccess = accessibleStages?.some((stage) =>
      stage.stage_name.toLowerCase().includes("die cutting") && 
      (stage.can_work || stage.can_manage)
    );

    return hasDieCuttingAccess;
  }, [isAdmin, isManager, userGroups, accessibleStages]);

  // Show loading state
  if (roleLoading || groupsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading factory floor...</p>
        </div>
      </div>
    );
  }

  // Show die cutting kanban view for authorized users
  if (shouldShowDieCuttingView) {
    return <DieCuttingKanbanView />;
  }

  // Default factory floor for everyone else
  return <UniversalFactoryFloor />;
};

export default FactoryFloor;

import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsManagement() {
  const { user } = useAuth();

  const { data: userGroups, isLoading } = useQuery({
    queryKey: ["user-management-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_group_memberships")
        .select(`
          user_groups!inner(
            name
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Check if user is in Management or Die Cutting groups
  const isManagement = userGroups?.some((g) => {
    const groupName = g.user_groups?.name?.toLowerCase() || "";
    return groupName.includes("management") || groupName.includes("die cutting");
  }) || false;

  return {
    isManagement,
    isLoading,
    userGroups,
  };
}

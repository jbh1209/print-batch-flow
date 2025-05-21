import { supabase } from "@/integrations/supabase/client";

export const isExistingTable = async (tableName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("pg_tables")
      .select("tablename")
      .eq("schemaname", "public")
      .eq("tablename", tableName);

    if (error) {
      console.error("Error checking table existence:", error);
      return false;
    }

    return data !== null && data.length > 0;
  } catch (error) {
    console.error("Error checking table existence:", error);
    return false;
  }
};

// Add this type alias for the ValidTableName
export type ValidTableName = string;

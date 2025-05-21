
import { supabase } from "@/integrations/supabase/client";

// Define the valid table names for type checking
export type ValidTableName = 
  | "business_card_jobs"
  | "flyer_jobs"
  | "box_jobs"
  | "postcard_jobs"
  | "poster_jobs"
  | "cover_jobs"
  | "sleeve_jobs"
  | "sticker_jobs"
  | "batches"
  | "profiles"
  | "user_roles";

export const isExistingTable = async (tableName: string): Promise<boolean> => {
  try {
    // Use a hardcoded list of known tables instead of querying pg_tables
    const validTables: ValidTableName[] = [
      "business_card_jobs",
      "flyer_jobs",
      "box_jobs",
      "postcard_jobs",
      "poster_jobs",
      "cover_jobs",
      "sleeve_jobs",
      "sticker_jobs",
      "batches",
      "profiles", 
      "user_roles"
    ];
    
    return validTables.includes(tableName as ValidTableName);
  } catch (error) {
    console.error("Error checking table existence:", error);
    return false;
  }
};

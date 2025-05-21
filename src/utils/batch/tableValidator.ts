
import { isExistingTable } from "@/utils/database/tableUtils";
import { toast } from "sonner";
import { ProductConfig } from "@/config/productTypes";

export const validateTableConfig = (
  tableName: string | undefined, 
  productType: string
): boolean => {
  if (!tableName || !isExistingTable(tableName)) {
    console.error(`Invalid table name: ${tableName}`);
    toast.error(`Cannot create batch: Invalid table configuration for ${productType}`);
    return false;
  }
  return true;
};

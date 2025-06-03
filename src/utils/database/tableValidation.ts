
import { ExistingTableName } from "@/config/productTypes";
import { existingTables } from "./tableUtils";

export function isExistingTable(tableName: string): tableName is ExistingTableName {
  return existingTables.includes(tableName as ExistingTableName);
}

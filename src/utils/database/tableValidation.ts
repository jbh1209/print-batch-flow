
import { ExistingTableName } from "@/config/productTypes";
import { existingTables } from "./tableUtils";

export type ValidTableName = ExistingTableName;

export function isExistingTable(tableName: string): tableName is ExistingTableName {
  return existingTables.includes(tableName as ExistingTableName);
}

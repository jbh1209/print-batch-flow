import { ExcelImportDebugger } from "../debugger";
import { ParsedJob } from "../types";
import { ExcelImportOrchestrator, SimplifiedImportResult } from "./ExcelImportOrchestrator";

/**
 * Simplified Excel parser using the new clean architecture
 */
export async function processJobsWithSimplifiedArchitecture(
  jobs: ParsedJob[],
  excelRows: any[][],
  headers: string[],
  logger: ExcelImportDebugger
): Promise<SimplifiedImportResult> {
  logger.addDebugInfo("🔄 Using SIMPLIFIED ARCHITECTURE v2.0");
  
  const orchestrator = new ExcelImportOrchestrator(logger);
  const result = await orchestrator.processJobs(jobs, excelRows, headers);
  
  return result;
}

/**
 * Save simplified results to database
 */
export async function saveSimplifiedResultsToDatabase(
  result: SimplifiedImportResult,
  userId: string,
  logger: ExcelImportDebugger
): Promise<{ successful: number; failed: number; errors: string[] }> {
  const orchestrator = new ExcelImportOrchestrator(logger);
  return await orchestrator.saveToDatabase(result, userId);
}
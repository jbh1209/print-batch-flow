import { JobInput } from "@/schemas/job.schema";
import {
  JobStage,
  JobTask,
  JobTaskDependency,
  JobWorkflow,
} from "@/schemas/job-workflow.schema";
import { v4 as uuidv4 } from "uuid";
import { ExcelImportDebugger } from "./debugger";

interface MappedData {
  mappedStageId: string;
  quantity: number;
  [key: string]: any;
}

interface JobCreationResult {
  job: JobInput;
  jobWorkflow: JobWorkflow;
}

export const enhancedJobCreator = (
  excelData: any[],
  columnMapping: any,
  logger: ExcelImportDebugger
): JobCreationResult => {
  logger.addDebugInfo(`Starting enhanced job creation from ${excelData.length} rows.`);

  const mappedData: MappedData[] = excelData.map((row: any) => {
    const mappedRow: { [key: string]: any } = {};
    for (const [excelColumn, jobProperty] of Object.entries(columnMapping)) {
      mappedRow[jobProperty as string] = row[excelColumn as string];
    }
    return mappedRow as MappedData;
  });

  logger.addDebugInfo(`Mapped ${mappedData.length} rows based on column mapping.`);

  const job = {} as JobInput;
  const jobWorkflow: JobWorkflow = {
    stages: [],
    tasks: [],
    dependencies: [],
  };

  // Populate job properties from the first row
  if (mappedData.length > 0) {
    const firstRow = mappedData[0];
    for (const key in firstRow) {
      if (!["mappedStageId", "quantity"].includes(key)) {
        (job as any)[key] = firstRow[key];
      }
    }
    logger.addDebugInfo(`Populated job properties from the first row.`);
  }

  // Create stages and tasks
  const stageMap = new Map<string, JobStage>();
  const taskMap = new Map<string, JobTask>();
  const stageCountMap = new Map<string, number>();

  mappedData.forEach((item, index) => {
    if (!item.mappedStageId) return;

    const currentCount = stageCountMap.get(item.mappedStageId) || 0;
    stageCountMap.set(item.mappedStageId, currentCount + 1);

    const stageId =
      currentCount === 0 ? item.mappedStageId : `${item.mappedStageId}-${currentCount + 1}`;

    if (!stageMap.has(stageId)) {
      const newStage: JobStage = {
        id: stageId,
        name: `Stage ${stageId}`,
        order: stageCountMap.size,
      };
      stageMap.set(stageId, newStage);
      jobWorkflow.stages.push(newStage);
      logger.addDebugInfo(`Created stage: ${newStage.name} with ID ${newStage.id}`);
    }

    const taskName = `Task for ${stageId} - Row ${index + 1}`;
    const newTask: JobTask = {
      id: uuidv4(),
      stageId: stageId,
      name: taskName,
      order: index + 1,
    };
    taskMap.set(newTask.id, newTask);
    jobWorkflow.tasks.push(newTask);
    logger.addDebugInfo(`Created task: ${newTask.name} with ID ${newTask.id} in stage ${stageId}`);
  });

  // Create dependencies (simple linear dependency)
  const tasks = Array.from(taskMap.values());
  for (let i = 1; i < tasks.length; i++) {
    const dependency: JobTaskDependency = {
      sourceTaskId: tasks[i].id,
      targetTaskId: tasks[i - 1].id,
    };
    jobWorkflow.dependencies.push(dependency);
    logger.addDebugInfo(
      `Created dependency: Task ${tasks[i].name} depends on Task ${tasks[i - 1].name}`
    );
  }

    // Create quantity map using unique IDs (matching stage creation logic)
    const quantityMap = new Map<string, number>();
    
    // Use the same unique ID generation logic as stage creation
    const stageCountMap2 = new Map<string, number>();
    
    for (const item of mappedData) {
      if (item.mappedStageId && item.quantity !== undefined) {
        const currentCount = stageCountMap2.get(item.mappedStageId) || 0;
        stageCountMap2.set(item.mappedStageId, currentCount + 1);
        
        // Generate unique ID using same logic as jobWorkflowInitializer
        const uniqueId = currentCount === 0 ? item.mappedStageId : `${item.mappedStageId}-${currentCount + 1}`;
        quantityMap.set(uniqueId, item.quantity);
      }
    }

  // Assign quantities to tasks based on stage and row
  tasks.forEach((task) => {
    const stageId = task.stageId;
    if (quantityMap.has(stageId)) {
      task.quantity = quantityMap.get(stageId);
      logger.addDebugInfo(`Assigned quantity ${task.quantity} to task ${task.name}`);
    }
  });

  logger.addDebugInfo(
    `Enhanced job creation completed. ${jobWorkflow.stages.length} stages, ${jobWorkflow.tasks.length} tasks, and ${jobWorkflow.dependencies.length} dependencies created.`
  );

  return { job, jobWorkflow };
};

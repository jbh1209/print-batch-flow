
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

export function useKanbanDnDContext({ stages, jobStages, reorderRefs, handleReorder }: {
  stages: any[];
  jobStages: any[];
  reorderRefs: React.MutableRefObject<Record<string, (order: string[]) => void>>;
  handleReorder: (stageId: string, newOrder: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (event: any) => {
    for (const stage of stages.filter(s => s.is_active)) {
      const colJobStages = jobStages.filter(js => js.production_stage_id === stage.id)
        .sort((a, b) => (a.job_order_in_stage ?? 1) - (b.job_order_in_stage ?? 1) || a.stage_order - b.stage_order);
      const jobIds = colJobStages.map(js => js.id);

      if (
        jobIds.includes(event.active.id as string) &&
        jobIds.includes(event.over?.id as string)
      ) {
        const oldIndex = jobIds.indexOf(event.active.id as string);
        const newIndex = jobIds.indexOf(event.over?.id as string);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newOrder = [...jobIds];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, event.active.id);
          reorderRefs.current[stage.id]?.(newOrder);
        }
        break;
      }
    }
  };

  return { sensors, onDragEnd };
}

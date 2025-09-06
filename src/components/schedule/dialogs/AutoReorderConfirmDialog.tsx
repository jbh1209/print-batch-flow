import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Sparkles } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableGroupCard } from "./SortableGroupCard";

interface GroupPreview {
  id: string;
  groupName: string;
  count: number;
  jobs: string[];
  originalIndex: number;
}

interface AutoReorderConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customGroupOrder?: string[]) => void;
  isProcessing: boolean;
  groupingType: 'paper' | 'lamination';
  groupPreviews: GroupPreview[];
  totalJobs: number;
}

export const AutoReorderConfirmDialog: React.FC<AutoReorderConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  groupingType,
  groupPreviews,
  totalJobs
}) => {
  const [reorderedGroups, setReorderedGroups] = useState<GroupPreview[]>(groupPreviews);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const icon = groupingType === 'paper' ? Package : Sparkles;
  const title = groupingType === 'paper' ? 'Group by Paper Specifications' : 'Group by Lamination Type';

  // Update reordered groups when groupPreviews change
  React.useEffect(() => {
    setReorderedGroups(groupPreviews);
  }, [groupPreviews]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setReorderedGroups((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleConfirm = () => {
    const customOrder = reorderedGroups.map(group => group.groupName);
    onConfirm(customOrder);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[75vw] max-w-[75vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {React.createElement(icon, { className: "h-5 w-5" })}
            {title}
          </DialogTitle>
          <DialogDescription>
            This will reorder {totalJobs} jobs to group them by {groupingType} specifications.
            Jobs with the same specifications will be placed together to minimize changeover time.
            Drag groups to reorder them by priority.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="text-sm font-medium text-muted-foreground">
            Grouping Preview (drag to reorder):
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={reorderedGroups.map(group => group.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {reorderedGroups.map((group) => (
                  <SortableGroupCard key={group.id} group={group} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? 'Grouping...' : 'Confirm Reorder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
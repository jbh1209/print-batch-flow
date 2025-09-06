import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

interface GroupPreview {
  id: string;
  groupName: string;
  count: number;
  jobs: string[];
  originalIndex: number;
}

interface SortableGroupCardProps {
  group: GroupPreview;
}

export const SortableGroupCard: React.FC<SortableGroupCardProps> = ({ group }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-3 space-y-2 bg-background ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:bg-muted/50'
      } transition-colors`}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Badge variant="outline" className="font-medium">
          {group.groupName}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {group.count} job{group.count > 1 ? 's' : ''}
        </span>
      </div>
      <div className="text-xs text-muted-foreground ml-6">
        Jobs: {group.jobs.join(', ')}
      </div>
    </div>
  );
};

import React from "react";
import JobStageCard from "./JobStageCard";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  jobStage: any;
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  onClick?: () => void;
  highlighted?: boolean;
};
// DnD wrapper for a sortable card
const SortableJobStageCard: React.FC<Props> = ({
  jobStage,
  onStageAction,
  onClick,
  highlighted
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: jobStage.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: "pointer",
    outline: highlighted ? "2px solid #22c55e" : undefined, // Tailwind green-500
    borderRadius: highlighted ? 8 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick} tabIndex={0}>
      <JobStageCard jobStage={jobStage} onStageAction={onStageAction} />
    </div>
  );
};

export default SortableJobStageCard;

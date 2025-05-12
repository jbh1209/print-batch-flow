
import React from "react";
import { Badge } from "@/components/ui/badge";
import { cva } from "class-variance-authority";

type StatusType = "queued" | "batched" | "completed" | "cancelled" | "processing" | "sent_to_print";

const statusVariants = cva("", {
  variants: {
    status: {
      queued: "bg-blue-100 text-blue-800 hover:bg-blue-100/80",
      batched: "bg-purple-100 text-purple-800 hover:bg-purple-100/80",
      completed: "bg-green-100 text-green-800 hover:bg-green-100/80",
      cancelled: "bg-red-100 text-red-800 hover:bg-red-100/80",
      processing: "bg-amber-100 text-amber-800 hover:bg-amber-100/80",
      sent_to_print: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100/80",
    },
  },
  defaultVariants: {
    status: "queued",
  },
});

interface JobStatusBadgeProps {
  status: string;
}

const StatusMap: Record<string, string> = {
  queued: "Queued",
  batched: "Batched",
  completed: "Completed",
  cancelled: "Cancelled",
  processing: "Processing",
  sent_to_print: "Sent to Print"
};

const JobStatusBadge: React.FC<JobStatusBadgeProps> = ({ status }) => {
  // Validate status is one of our known types
  const validStatus = (Object.keys(StatusMap).includes(status) 
    ? status 
    : "queued") as StatusType;
  
  const displayText = StatusMap[validStatus] || "Unknown";
  
  return (
    <Badge 
      variant="outline" 
      className={statusVariants({ status: validStatus })}
    >
      {displayText}
    </Badge>
  );
};

export default JobStatusBadge;

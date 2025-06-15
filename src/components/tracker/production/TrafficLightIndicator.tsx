
import React from "react";
import { getDueStatusColor } from "@/utils/tracker/trafficLightUtils";

interface TrafficLightIndicatorProps {
  dueDate?: string | null;
}

export const TrafficLightIndicator: React.FC<TrafficLightIndicatorProps> = ({ dueDate }) => {
  const color = getDueStatusColor(dueDate);
  // Map color names to Tailwind
  const colorMap: Record<string, string> = {
    "red": "bg-red-500",
    "yellow": "bg-yellow-400",
    "green": "bg-green-500",
    "gray": "bg-gray-400"
  };
  // Default to gray if unknown
  const bgClass = colorMap[color] || "bg-gray-400";
  return (
    <div className="flex items-center" title={`Due: ${dueDate ?? "N/A"}`}>
      <span 
        className={`inline-block w-3 h-3 rounded-full mr-1 border-2 border-white shadow ${bgClass}`}
        aria-label={`${color} status`}
      />
    </div>
  );
};

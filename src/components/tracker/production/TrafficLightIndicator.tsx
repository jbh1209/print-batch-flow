
import React, { useEffect, useState } from "react";
import { getDueStatusColor } from "@/utils/tracker/trafficLightUtils";

interface TrafficLightIndicatorProps {
  dueDate?: string | null;
  originalCommittedDueDate?: string | null;
  showDetailed?: boolean;
}

export const TrafficLightIndicator: React.FC<TrafficLightIndicatorProps> = ({ dueDate, originalCommittedDueDate, showDetailed = false }) => {
  const [statusInfo, setStatusInfo] = useState({
    color: "#9CA3AF",
    label: "Loading...",
    code: "gray" as "red" | "yellow" | "green" | "gray"
  });

  useEffect(() => {
    const getStatus = async () => {
      const info = await getDueStatusColor(dueDate);
      setStatusInfo(info);
    };

    getStatus();
  }, [dueDate]);

  // Map code to Tailwind classes
  const colorMap: Record<"red" | "yellow" | "green" | "gray", string> = {
    "red": "bg-red-500",
    "yellow": "bg-yellow-400",
    "green": "bg-green-500",
    "gray": "bg-gray-400"
  };

  // Default to gray if unknown or unexpected code
  const bgClass = colorMap[statusInfo.code] || "bg-gray-400";
  
  // Determine if there's a delay and add visual indicator
  const hasDelay = originalCommittedDueDate && dueDate && 
    new Date(dueDate) > new Date(originalCommittedDueDate);

  return (
    <div className="flex items-center" title={`Due: ${dueDate ?? "N/A"}${originalCommittedDueDate ? `, Original: ${originalCommittedDueDate}` : ''}`}>
      <span
        className={`inline-block w-3 h-3 rounded-full mr-1 border-2 border-white shadow ${bgClass}`}
        aria-label={`${statusInfo.code} status`}
      />
      {showDetailed && hasDelay && (
        <span className="text-xs bg-amber-100 text-amber-800 px-1 py-0.5 rounded ml-1">
          Delayed
        </span>
      )}
    </div>
  );
};

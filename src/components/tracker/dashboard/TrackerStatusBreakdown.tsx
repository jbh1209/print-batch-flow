
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface TrackerStatusBreakdownProps {
  stats: {
    total: number;
    statusCounts: Record<string, number>;
    stages: Array<{ id: string; name: string; color: string }>;
  };
}

export const TrackerStatusBreakdown = ({ stats }: TrackerStatusBreakdownProps) => {
  // Get all stages plus fallback statuses
  const allStagesAndStatuses = [
    { name: "Pre-Press", color: "#3B82F6" },
    ...stats.stages.map(stage => ({ name: stage.name, color: stage.color }))
  ];

  // Remove duplicates
  const uniqueStagesAndStatuses = allStagesAndStatuses.filter((item, index, self) => 
    index === self.findIndex(t => t.name === item.name)
  );

  const getStatusColor = (color: string) => {
    // Convert hex color to Tailwind-like classes
    return `bg-blue-100 text-blue-800 border-blue-200`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs by Status</CardTitle>
        <CardDescription>Current distribution of jobs across workflow stages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {uniqueStagesAndStatuses.map(item => {
            const count = stats.statusCounts[item.name] || 0;
            return (
              <div key={item.name} className="text-center">
                <Badge 
                  className={`mb-2 ${getStatusColor(item.color)} border`}
                  style={{ backgroundColor: `${item.color}20`, color: item.color, borderColor: `${item.color}40` }}
                >
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {item.name}
                  </span>
                </Badge>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-gray-500">jobs</div>
              </div>
            );
          })}
        </div>

        {stats.total === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No jobs in the system yet</p>
            <p className="text-sm">Upload jobs to see status breakdown</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

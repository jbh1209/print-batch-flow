
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

interface TrackerOverviewStatsProps {
  stats: {
    jobs: any[];
    stages: Array<{ id: string; name: string; color: string }>;
    statusCounts: Record<string, number>;
    total: number;
  };
}

export const TrackerOverviewStats = ({ stats }: TrackerOverviewStatsProps) => {
  // Only show real stages from DB, ordered
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
      {stats.stages.map(stage => {
        const count = stats.jobs.filter(
          job => job.status === stage.name
        ).length;
        return (
          <Card key={stage.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full mr-1"
                  style={{ backgroundColor: stage.color }}
                ></span>
                {stage.name}
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
              <p className="text-xs text-muted-foreground">Jobs in {stage.name}</p>
            </CardContent>
          </Card>
        );
      })}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">All production jobs</p>
        </CardContent>
      </Card>
    </div>
  );
};

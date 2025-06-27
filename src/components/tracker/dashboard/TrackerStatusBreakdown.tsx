
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface StatsProps {
  stats: {
    total: number;
    inProgress: number;
    completed: number;
    pending: number;
    dueToday: number;
    dueThisWeek: number;
    overdue: number;
    critical: number;
    statusCounts: Record<string, number>;
    stages: Array<{ name: string; color: string; count: number }>;
  };
}

export const TrackerStatusBreakdown: React.FC<StatsProps> = ({ stats }) => {
  // Prepare chart data from stages
  const stageChartData = stats.stages.map(stage => ({
    name: stage.name,
    count: stage.count,
    fill: stage.color
  }));

  // Prepare status chart data
  const statusChartData = Object.entries(stats.statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status,
      count,
      fill: status === 'Completed' ? '#10B981' : 
            status === 'Pre-Press' ? '#F59E0B' :
            status === 'Printing' ? '#3B82F6' : '#6B7280'
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Active Stages Breakdown */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Active Production Stages
            <Badge variant="secondary" className="ml-2">
              {stats.stages.reduce((sum, stage) => sum + stage.count, 0)} jobs
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.stages.length > 0 ? (
            <div className="space-y-4">
              {/* Stage List */}
              <div className="space-y-3 mb-6">
                {stats.stages.slice(0, 8).map((stage, index) => (
                  <div key={stage.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-medium text-lg">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="text-lg px-3 py-1 font-bold"
                        style={{ 
                          borderColor: stage.color,
                          color: stage.color 
                        }}
                      >
                        {stage.count}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar Chart */}
              {stageChartData.length > 0 && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stageChartData}>
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis fontSize={12} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No active production stages found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Overview */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Job Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {statusChartData.length > 0 ? (
            <div className="space-y-4">
              {/* Status List */}
              <div className="space-y-3 mb-6">
                {statusChartData.map((status) => (
                  <div key={status.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: status.fill }}
                      />
                      <span className="font-medium text-lg">{status.name}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-lg px-3 py-1 font-bold"
                      style={{ 
                        borderColor: status.fill,
                        color: status.fill 
                      }}
                    >
                      {status.count}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Pie Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                      fontSize={12}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No job status data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

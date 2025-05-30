import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target, 
  AlertTriangle,
  Activity,
  RefreshCw,
  Calendar
} from "lucide-react";
import { useWorkflowAnalytics } from "@/hooks/tracker/useWorkflowAnalytics";
import { DatePickerWithRange } from "@/components/ui/date-picker";

const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  color = "blue" 
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) => {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    yellow: "text-yellow-600 bg-yellow-50",
    red: "text-red-600 bg-red-50",
    purple: "text-purple-600 bg-purple-50"
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">{value}</span>
              {trend && (
                <div className={`flex items-center ${
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                  {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StagePerformanceChart = ({ analytics }: { analytics: any[] }) => {
  const chartData = analytics.map(stage => ({
    name: stage.stage_name,
    completion_rate: stage.completion_rate,
    avg_duration: stage.avg_duration_hours,
    active_jobs: stage.active_jobs,
    bottleneck_score: stage.bottleneck_score
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="completion_rate" fill="#3B82F6" name="Completion Rate %" />
        <Bar dataKey="avg_duration" fill="#10B981" name="Avg Duration (hrs)" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const BottleneckChart = ({ bottleneckStages }: { bottleneckStages: any[] }) => {
  const chartData = bottleneckStages.map((stage, index) => ({
    name: stage.stage_name,
    bottleneck_score: stage.bottleneck_score,
    active_jobs: stage.active_jobs,
    fill: ['#EF4444', '#F59E0B', '#6B7280'][index] || '#6B7280'
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value.toFixed(1)}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="bottleneck_score"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const WorkflowAnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const { 
    analytics, 
    workflowMetrics, 
    categoryPerformance,
    topPerformingStages,
    slowestStages,
    isLoading, 
    error, 
    refreshAnalytics 
  } = useWorkflowAnalytics(dateRange);

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-medium">Error loading analytics</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Analytics</h1>
          <p className="text-gray-600">Performance insights and bottleneck analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerWithRange 
            value={dateRange}
            onChange={setDateRange}
          />
          <Button 
            variant="outline" 
            onClick={refreshAnalytics}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {workflowMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Jobs"
            value={workflowMetrics.total_active_jobs}
            subtitle="Currently in progress"
            icon={Activity}
            color="blue"
          />
          <MetricCard
            title="Completion Rate"
            value={`${workflowMetrics.workflow_completion_rate.toFixed(1)}%`}
            subtitle="Overall workflow completion"
            icon={Target}
            trend={workflowMetrics.workflow_completion_rate > 80 ? "up" : "down"}
            color="green"
          />
          <MetricCard
            title="Avg Duration"
            value={`${workflowMetrics.avg_workflow_duration.toFixed(1)}h`}
            subtitle="Average stage duration"
            icon={Clock}
            color="yellow"
          />
          <MetricCard
            title="Efficiency Score"
            value={`${workflowMetrics.efficiency_score.toFixed(0)}%`}
            subtitle="Workflow efficiency"
            icon={TrendingUp}
            trend={workflowMetrics.efficiency_score > 75 ? "up" : "down"}
            color="purple"
          />
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stages">Stage Analysis</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Stage Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <StagePerformanceChart analytics={analytics} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Stages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topPerformingStages.slice(0, 5).map((stage, index) => (
                  <div key={stage.stage_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.stage_color }} />
                      <span className="font-medium">{stage.stage_name}</span>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {stage.completion_rate.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Stage Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Stage</th>
                        <th className="text-left p-2">Active Jobs</th>
                        <th className="text-left p-2">Completed</th>
                        <th className="text-left p-2">Avg Duration</th>
                        <th className="text-left p-2">Completion Rate</th>
                        <th className="text-left p-2">Bottleneck Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.map(stage => (
                        <tr key={stage.stage_id} className="border-b">
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.stage_color }} />
                              {stage.stage_name}
                            </div>
                          </td>
                          <td className="p-2">{stage.active_jobs}</td>
                          <td className="p-2">{stage.completed_jobs}</td>
                          <td className="p-2">{stage.avg_duration_hours.toFixed(1)}h</td>
                          <td className="p-2">
                            <Badge variant="outline" className={
                              stage.completion_rate > 80 ? "bg-green-50 text-green-700" :
                              stage.completion_rate > 60 ? "bg-yellow-50 text-yellow-700" :
                              "bg-red-50 text-red-700"
                            }>
                              {stage.completion_rate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Badge variant="outline" className={
                              stage.bottleneck_score > 5 ? "bg-red-50 text-red-700" :
                              stage.bottleneck_score > 2 ? "bg-yellow-50 text-yellow-700" :
                              "bg-green-50 text-green-700"
                            }>
                              {stage.bottleneck_score.toFixed(1)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Bottleneck Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {workflowMetrics?.bottleneck_stages && (
                  <BottleneckChart bottleneckStages={workflowMetrics.bottleneck_stages} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slowest Stages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {slowestStages.slice(0, 5).map((stage, index) => (
                  <div key={stage.stage_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.stage_color }} />
                      <span className="font-medium">{stage.stage_name}</span>
                    </div>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">
                      {stage.avg_duration_hours.toFixed(1)}h
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {categoryPerformance.map(category => (
              <Card key={category.category_id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.category_color }} />
                    {category.category_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Total Jobs:</span>
                      <div className="font-medium">{category.total_jobs}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg Time:</span>
                      <div className="font-medium">{category.avg_completion_time.toFixed(1)}h</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 text-sm">Completion Rate:</span>
                    <div className="font-medium">{category.completion_rate.toFixed(1)}%</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-600 text-sm">Stages:</span>
                    {category.stages.slice(0, 3).map(stage => (
                      <div key={stage.stage_id} className="flex items-center justify-between text-xs">
                        <span>{stage.stage_name}</span>
                        <Badge variant="outline">
                          {stage.completion_rate.toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

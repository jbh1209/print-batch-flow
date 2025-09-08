import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter
} from 'recharts';
import {
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useTimingVarianceTracking } from '@/hooks/tracker/useTimingVarianceTracking';
import { useRealTimeQueueUpdates } from '@/hooks/tracker/useRealTimeQueueUpdates';
import { DatePickerWithRange } from '@/components/ui/date-picker';

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
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">{value}</span>
              {trend && (
                <div className={`flex items-center ${
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                  {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const TimingVarianceChart = ({ variances }: { variances: any[] }) => {
  const chartData = variances.slice(0, 20).map((variance, index) => ({
    job: variance.wo_no,
    variance: variance.variance_minutes,
    percentage: variance.variance_percentage,
    stage: variance.stage_name
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="job" />
        <YAxis />
        <Tooltip formatter={(value, name) => [
          name === 'variance' ? `${value} min` : `${value}%`,
          name === 'variance' ? 'Variance (min)' : 'Variance (%)'
        ]} />
        <Scatter dataKey="variance" fill="#3B82F6" />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

const SchedulingAccuracyChart = ({ accuracyMetrics }: { accuracyMetrics: any }) => {
  const chartData = [
    { name: 'On Time', value: accuracyMetrics.on_time_stages, fill: '#22C55E' },
    { name: 'Early', value: accuracyMetrics.early_stages, fill: '#3B82F6' },
    { name: 'Late', value: accuracyMetrics.late_stages, fill: '#EF4444' }
  ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const RealTimeUpdates = ({ updates }: { updates: any[] }) => {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {updates.slice(0, 10).map((update, index) => (
        <div key={index} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
          <div className={`p-1 rounded-full ${
            update.priority === 'high' ? 'bg-red-100' :
            update.priority === 'medium' ? 'bg-yellow-100' : 'bg-green-100'
          }`}>
            {update.type === 'stage_started' && <Zap className="h-3 w-3 text-yellow-600" />}
            {update.type === 'stage_completed' && <CheckCircle className="h-3 w-3 text-green-600" />}
            {update.type === 'job_expedited' && <AlertTriangle className="h-3 w-3 text-red-600" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{update.message}</p>
            <p className="text-xs text-muted-foreground">
              {update.wo_no} - {update.stage_name} • {new Date(update.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export const SupervisorPerformanceDashboard = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  
  const { 
    variances, 
    accuracyMetrics, 
    isLoading: timingLoading, 
    error: timingError,
    refreshData 
  } = useTimingVarianceTracking(dateRange);

  const { 
    updates, 
    metrics, 
    isConnected 
  } = useRealTimeQueueUpdates();

  if (timingError) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-medium">Error loading performance data</p>
                <p className="text-sm">{timingError}</p>
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
          <h1 className="text-3xl font-bold">Supervisor Performance Dashboard</h1>
          <p className="text-muted-foreground">Real-time tracking and scheduling accuracy insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-600' : 'bg-red-600'
            }`} />
            {isConnected ? 'Live Updates' : 'Disconnected'}
          </div>
          <DatePickerWithRange 
            value={dateRange}
            onChange={setDateRange}
          />
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={timingLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${timingLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Active Jobs"
            value={metrics.active_jobs}
            subtitle="Currently in progress"
            icon={Clock}
            color="blue"
          />
          <MetricCard
            title="Stages Running"
            value={metrics.stages_in_progress}
            subtitle="Active production stages"
            icon={Zap}
            color="yellow"
          />
          <MetricCard
            title="Completed Today"
            value={metrics.completed_today}
            subtitle="Stages finished today"
            icon={CheckCircle}
            color="green"
          />
          <MetricCard
            title="Upcoming Deadlines"
            value={metrics.upcoming_deadlines}
            subtitle="Next 24 hours"
            icon={AlertTriangle}
            color="red"
          />
          {accuracyMetrics && (
            <MetricCard
              title="Schedule Accuracy"
              value={`${accuracyMetrics.accuracy_percentage.toFixed(1)}%`}
              subtitle="On-time completion rate"
              icon={Target}
              trend={accuracyMetrics.improvement_trend === 'improving' ? 'up' : 'down'}
              color="purple"
            />
          )}
        </div>
      )}

      <Tabs defaultValue="timing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timing">Timing Analysis</TabsTrigger>
          <TabsTrigger value="accuracy">Schedule Accuracy</TabsTrigger>
          <TabsTrigger value="realtime">Real-time Updates</TabsTrigger>
        </TabsList>

        <TabsContent value="timing" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Timing Variance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <TimingVarianceChart variances={variances} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Variance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {accuracyMetrics && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {((accuracyMetrics.early_stages / accuracyMetrics.total_completed_stages) * 100).toFixed(1)}%
                        </div>
                        <p className="text-sm text-muted-foreground">Early Completion</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {((accuracyMetrics.late_stages / accuracyMetrics.total_completed_stages) * 100).toFixed(1)}%
                        </div>
                        <p className="text-sm text-muted-foreground">Late Completion</p>
                      </div>
                    </div>
                    <div className="text-center pt-2 border-t">
                      <div className="text-lg font-semibold">
                        Avg Variance: {accuracyMetrics.avg_variance_minutes.toFixed(1)} min
                      </div>
                      <Badge variant="outline" className={
                        accuracyMetrics.improvement_trend === 'improving' ? 'bg-green-50 text-green-700' :
                        accuracyMetrics.improvement_trend === 'declining' ? 'bg-red-50 text-red-700' :
                        'bg-yellow-50 text-yellow-700'
                      }>
                        {accuracyMetrics.improvement_trend}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="accuracy" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Schedule Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {accuracyMetrics && <SchedulingAccuracyChart accuracyMetrics={accuracyMetrics} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Worst Performing Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {variances
                    .filter(v => Math.abs(v.variance_percentage) > 20)
                    .slice(0, 5)
                    .map((variance, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <p className="font-medium">{variance.wo_no}</p>
                          <p className="text-sm text-muted-foreground">{variance.stage_name}</p>
                        </div>
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {variance.variance_percentage > 0 ? '+' : ''}{variance.variance_percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Activity Feed</CardTitle>
              </CardHeader>
              <CardContent>
                <RealTimeUpdates updates={updates} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Queue Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Active Jobs</span>
                      <span className="text-lg font-bold">{metrics.active_jobs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Stages Running</span>
                      <span className="text-lg font-bold">{metrics.stages_in_progress}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Completed Today</span>
                      <span className="text-lg font-bold text-green-600">{metrics.completed_today}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Upcoming Deadlines</span>
                      <span className={`text-lg font-bold ${
                        metrics.upcoming_deadlines > 5 ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {metrics.upcoming_deadlines}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
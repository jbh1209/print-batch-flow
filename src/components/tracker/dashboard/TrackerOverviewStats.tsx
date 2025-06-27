
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Calendar,
  Target,
  TrendingUp,
  Users
} from "lucide-react";

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
    stages: any[];
  };
}

export const TrackerOverviewStats: React.FC<StatsProps> = ({ stats }) => {
  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = "blue", 
    urgency = "normal" 
  }: {
    title: string;
    value: number;
    icon: any;
    color?: string;
    urgency?: "normal" | "warning" | "critical";
  }) => {
    const getCardStyles = () => {
      switch (urgency) {
        case "critical":
          return "border-red-200 bg-red-50 text-red-900";
        case "warning":
          return "border-orange-200 bg-orange-50 text-orange-900";
        default:
          return "border-gray-200 bg-white text-gray-900";
      }
    };

    const getIconStyles = () => {
      switch (urgency) {
        case "critical":
          return "text-red-600 bg-red-100";
        case "warning":
          return "text-orange-600 bg-orange-100";
        default:
          return `text-${color}-600 bg-${color}-100`;
      }
    };

    const getValueStyles = () => {
      switch (urgency) {
        case "critical":
          return "text-red-700 text-4xl font-bold";
        case "warning":
          return "text-orange-700 text-4xl font-bold";
        default:
          return "text-gray-900 text-4xl font-bold";
      }
    };

    return (
      <Card className={`${getCardStyles()} shadow-lg`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium opacity-80 mb-2">{title}</p>
              <div className={getValueStyles()}>{value}</div>
            </div>
            <div className={`p-4 rounded-lg ${getIconStyles()}`}>
              <Icon className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
      {/* Critical Time-Based Metrics - Most Important */}
      <StatCard
        title="Overdue Jobs"
        value={stats.overdue}
        icon={AlertTriangle}
        urgency="critical"
      />
      
      <StatCard
        title="Due Today"
        value={stats.dueToday}
        icon={Calendar}
        urgency="warning"
      />

      <StatCard
        title="Due This Week"
        value={stats.dueThisWeek}
        icon={Clock}
        color="orange"
      />

      <StatCard
        title="Critical"
        value={stats.critical}
        icon={Target}
        urgency="critical"
      />

      {/* Standard Production Metrics */}
      <StatCard
        title="Total Jobs"
        value={stats.total}
        icon={Users}
        color="blue"
      />

      <StatCard
        title="In Progress"
        value={stats.inProgress}
        icon={Activity}
        color="blue"
      />

      <StatCard
        title="Pending Start"
        value={stats.pending}
        icon={Clock}
        color="yellow"
      />

      <StatCard
        title="Completed"
        value={stats.completed}
        icon={CheckCircle}
        color="green"
      />
    </div>
  );
};

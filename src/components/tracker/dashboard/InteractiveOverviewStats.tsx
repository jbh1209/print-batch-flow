
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
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
    dueTomorrow: number;
    dueThisWeek: number;
    overdue: number;
    critical: number;
    completedThisMonth: number;
    statusCounts: Record<string, number>;
    stages: any[];
  };
  activeFilter: string | null;
  onFilterClick: (filter: string) => void;
}

export const InteractiveOverviewStats: React.FC<StatsProps> = ({ 
  stats, 
  activeFilter, 
  onFilterClick 
}) => {
  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = "blue", 
    urgency = "normal",
    filter,
    clickable = true
  }: {
    title: string;
    value: number;
    icon: any;
    color?: string;
    urgency?: "normal" | "warning" | "critical";
    filter: string;
    clickable?: boolean;
  }) => {
    const isActive = activeFilter === filter;
    
    const getCardStyles = () => {
      let baseStyles = "transition-all duration-200 cursor-pointer hover:shadow-lg transform hover:scale-105";
      
      if (isActive) {
        baseStyles += " ring-2 ring-blue-500 shadow-lg scale-105";
      }
      
      switch (urgency) {
        case "critical":
          return `${baseStyles} border-red-200 ${isActive ? 'bg-red-100' : 'bg-red-50'} text-red-900`;
        case "warning":
          return `${baseStyles} border-orange-200 ${isActive ? 'bg-orange-100' : 'bg-orange-50'} text-orange-900`;
        default:
          return `${baseStyles} border-gray-200 ${isActive ? 'bg-blue-50' : 'bg-white'} text-gray-900`;
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
      const baseStyles = "text-4xl font-bold";
      if (isActive) {
        return `${baseStyles} text-blue-700`;
      }
      
      switch (urgency) {
        case "critical":
          return `${baseStyles} text-red-700`;
        case "warning":
          return `${baseStyles} text-orange-700`;
        default:
          return `${baseStyles} text-gray-900`;
      }
    };

    return (
      <Card 
        className={getCardStyles()}
        onClick={() => clickable && onFilterClick(filter)}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium opacity-80 mb-2">{title}</p>
              <div className={getValueStyles()}>{value}</div>
              {isActive && (
                <Badge variant="outline" className="mt-2 text-xs">
                  Active Filter
                </Badge>
              )}
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
        filter="overdue"
      />
      
      <StatCard
        title="Due Today"
        value={stats.dueToday}
        icon={Calendar}
        urgency="warning"
        filter="due_today"
      />

      <StatCard
        title="Due Tomorrow"
        value={stats.dueTomorrow}
        icon={Clock}
        color="orange"
        urgency="warning"
        filter="due_tomorrow"
      />

      <StatCard
        title="Due This Week"
        value={stats.dueThisWeek}
        icon={Clock}
        color="orange"
        filter="due_this_week"
      />

      <StatCard
        title="Critical"
        value={stats.critical}
        icon={Target}
        urgency="critical"
        filter="critical"
      />

      {/* Standard Production Metrics */}
      <StatCard
        title="Total Jobs"
        value={stats.total}
        icon={Users}
        color="blue"
        filter="total"
      />

      <StatCard
        title="In Progress"
        value={stats.inProgress}
        icon={Activity}
        color="blue"
        filter="in_progress"
      />

      <StatCard
        title="Completed This Month"
        value={stats.completedThisMonth}
        icon={CheckCircle}
        color="green"
        filter="completed_this_month"
      />
    </div>
  );
};

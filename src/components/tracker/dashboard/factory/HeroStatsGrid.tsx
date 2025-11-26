import React from "react";
import { 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Target, 
  Users, 
  Activity, 
  CheckCircle,
  TrendingUp 
} from "lucide-react";

interface HeroStatsGridProps {
  stats: {
    overdue: number;
    dueToday: number;
    dueTomorrow: number;
    critical: number;
    total: number;
    inProgress: number;
    completedThisMonth: number;
    dueThisWeek: number;
  };
}

export const HeroStatsGrid: React.FC<HeroStatsGridProps> = ({ stats }) => {
  const HeroStatTile = ({ 
    title, 
    value, 
    icon: Icon, 
    variant = "info",
    subtitle
  }: {
    title: string;
    value: number;
    icon: any;
    variant?: "critical" | "warning" | "success" | "info";
    subtitle?: string;
  }) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "critical":
          return "factory-critical border-red-500 bg-red-50 text-red-900";
        case "warning":
          return "factory-warning border-orange-500 bg-orange-50 text-orange-900";
        case "success":
          return "factory-success border-green-500 bg-green-50 text-green-900";
        default:
          return "factory-info border-blue-500 bg-blue-50 text-blue-900";
      }
    };

    const shouldPulse = variant === "critical" && value > 0;

    return (
      <div 
        className={`factory-hero-stat ${getVariantStyles()} ${shouldPulse ? 'factory-pulse' : ''}`}
      >
        <div className="flex items-center justify-between h-full">
          <div className="flex-1">
            <div className="text-2xl font-semibold opacity-80 mb-2">{title}</div>
            <div className="text-8xl font-bold leading-none mb-2">{value}</div>
            {subtitle && (
              <div className="text-lg opacity-70">{subtitle}</div>
            )}
          </div>
          <div className="flex-shrink-0 ml-6">
            <div className={`p-6 rounded-2xl ${
              variant === "critical" ? "bg-red-200" :
              variant === "warning" ? "bg-orange-200" :
              variant === "success" ? "bg-green-200" :
              "bg-blue-200"
            }`}>
              <Icon className="h-16 w-16" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      {/* Row 1: Critical Time-Based Metrics */}
      <HeroStatTile
        title="OVERDUE"
        value={stats.overdue}
        icon={AlertTriangle}
        variant="critical"
        subtitle="jobs past due"
      />
      
      <HeroStatTile
        title="DUE TODAY"
        value={stats.dueToday}
        icon={Calendar}
        variant="warning"
        subtitle="need completion"
      />

      <HeroStatTile
        title="DUE TOMORROW"
        value={stats.dueTomorrow}
        icon={Clock}
        variant="warning"
        subtitle="prepare for production"
      />

      <HeroStatTile
        title="CRITICAL"
        value={stats.critical}
        icon={Target}
        variant="critical"
        subtitle="require attention"
      />

      {/* Row 2: Production Metrics */}
      <HeroStatTile
        title="ACTIVE JOBS"
        value={stats.total}
        icon={Users}
        variant="info"
        subtitle="in production"
      />

      <HeroStatTile
        title="IN PROGRESS"
        value={stats.inProgress}
        icon={Activity}
        variant="info"
        subtitle="actively working"
      />

      <HeroStatTile
        title="COMPLETED"
        value={stats.completedThisMonth}
        icon={CheckCircle}
        variant="success"
        subtitle="this month"
      />

      <HeroStatTile
        title="DUE THIS WEEK"
        value={stats.dueThisWeek}
        icon={TrendingUp}
        variant="info"
        subtitle="upcoming deadlines"
      />
    </div>
  );
};
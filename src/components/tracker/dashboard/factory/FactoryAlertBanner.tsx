import React from "react";
import { AlertTriangle, Clock, Target, Bell } from "lucide-react";

interface FactoryAlertBannerProps {
  stats: {
    overdue: number;
    dueToday: number;
    critical: number;
  };
}

export const FactoryAlertBanner: React.FC<FactoryAlertBannerProps> = ({ stats }) => {
  const alerts = [];

  // Critical overdue jobs
  if (stats.overdue > 0) {
    alerts.push({
      type: 'critical',
      icon: AlertTriangle,
      message: `⚠️ CRITICAL: ${stats.overdue} job${stats.overdue > 1 ? 's' : ''} OVERDUE - Immediate attention required!`,
      priority: 1
    });
  }

  // Jobs due today
  if (stats.dueToday > 0) {
    alerts.push({
      type: 'warning',
      icon: Clock,
      message: `🔥 URGENT: ${stats.dueToday} job${stats.dueToday > 1 ? 's' : ''} due TODAY - Must complete by end of shift!`,
      priority: 2
    });
  }

  // Critical jobs (high priority)
  if (stats.critical > 5) {
    alerts.push({
      type: 'warning',
      icon: Target,
      message: `📢 HIGH LOAD: ${stats.critical} critical jobs in system - Monitor capacity closely!`,
      priority: 3
    });
  }

  // Sort alerts by priority
  alerts.sort((a, b) => a.priority - b.priority);

  // If no critical alerts, show positive message
  if (alerts.length === 0) {
    return (
      <div className="factory-alert-banner border-green-500 bg-gradient-to-r from-green-600 to-green-500">
        <div className="flex items-center justify-center gap-4">
          <Bell className="h-8 w-8 animate-pulse" />
          <span className="text-2xl">✅ ALL SYSTEMS NORMAL - Production running smoothly</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => {
        const Icon = alert.icon;
        const bgColor = alert.type === 'critical' 
          ? 'bg-gradient-to-r from-red-600 to-red-500' 
          : 'bg-gradient-to-r from-orange-600 to-orange-500';
        
        return (
          <div 
            key={index}
            className={`factory-alert-banner border-l-8 ${
              alert.type === 'critical' ? 'border-red-400' : 'border-orange-400'
            } ${bgColor}`}
          >
            <div className="flex items-center justify-center gap-6">
              <Icon className="h-10 w-10 animate-bounce" />
              <span className="text-2xl font-bold">{alert.message}</span>
              <Icon className="h-10 w-10 animate-bounce" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
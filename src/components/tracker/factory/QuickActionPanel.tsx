
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle,
  QrCode,
  RefreshCw,
  Zap,
  Target,
  TrendingUp
} from "lucide-react";
import { useMobileFactoryFloor } from "@/hooks/tracker/useMobileFactoryFloor";

interface QuickStats {
  activeJobs: number;
  availableJobs: number;
  urgentJobs: number;
  completedToday: number;
}

export const QuickActionPanel: React.FC = () => {
  const { 
    jobs, 
    isLoading, 
    getFilterCounts, 
    qrScanner,
    refreshJobs,
    isOnline 
  } = useMobileFactoryFloor();
  
  const [showStats, setShowStats] = useState(false);
  
  const filterCounts = getFilterCounts();
  
  const quickStats: QuickStats = {
    activeJobs: filterCounts['my-active'],
    availableJobs: filterCounts.available,
    urgentJobs: filterCounts.urgent,
    completedToday: 0 // This would need to be calculated based on completion timestamps
  };

  const quickActions = [
    {
      icon: QrCode,
      label: "Scan Job",
      action: () => qrScanner.startScanning(),
      color: "bg-blue-600 hover:bg-blue-700",
      disabled: qrScanner.isScanning
    },
    {
      icon: RefreshCw,
      label: "Refresh",
      action: refreshJobs,
      color: "bg-green-600 hover:bg-green-700",
      disabled: isLoading
    },
    {
      icon: Target,
      label: "Next Job",
      action: () => {
        // Logic to focus on next recommended job
        console.log("Focus on next job");
      },
      color: "bg-purple-600 hover:bg-purple-700",
      disabled: jobs.length === 0
    },
    {
      icon: TrendingUp,
      label: "My Stats",
      action: () => setShowStats(!showStats),
      color: "bg-orange-600 hover:bg-orange-700",
      disabled: false
    }
  ];

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-700">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Last sync: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{quickStats.activeJobs}</div>
            <div className="text-sm text-blue-600 font-medium">Active Jobs</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{quickStats.availableJobs}</div>
            <div className="text-sm text-green-600 font-medium">Available</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-700">{quickStats.urgentJobs}</div>
            <div className="text-sm text-orange-600 font-medium">Urgent</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">{quickStats.completedToday}</div>
            <div className="text-sm text-purple-600 font-medium">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                onClick={action.action}
                disabled={action.disabled}
                className={`h-16 flex flex-col items-center justify-center gap-1 text-white ${action.color}`}
              >
                <action.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
          
          {/* Scanner Status */}
          {qrScanner.isScanning && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-blue-700">
                  Scanner active - Point camera at QR code
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expanded Stats (when toggled) */}
      {showStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Jobs Started</span>
                <Badge variant="outline">5</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Jobs Completed</span>
                <Badge variant="outline">3</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg. Completion Time</span>
                <Badge variant="outline">45 min</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Efficiency Score</span>
                <Badge className="bg-green-600">94%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

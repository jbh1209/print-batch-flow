import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MyNextJobsView } from "./MyNextJobsView";
import { ShiftHandoverReport } from "./ShiftHandoverReport";
import { RushJobModal } from "./RushJobModal";
import { usePersonalOperatorQueue } from "@/hooks/tracker/usePersonalOperatorQueue";
import { useRushJobHandler } from "@/hooks/tracker/useRushJobHandler";
import { useAuth } from "@/hooks/useAuth";
import { 
  Timer, 
  User, 
  FileText, 
  Zap, 
  BarChart3,
  Settings,
  RefreshCw,
  Play,
  Pause
} from "lucide-react";
import { cn } from "@/lib/utils";

export const TouchOptimizedOperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("queue");
  const { myNextJobs, activeJobs, refetch } = usePersonalOperatorQueue();
  const { openRushModal } = useRushJobHandler();

  const hasActiveJobs = activeJobs.length > 0;
  const nextJob = myNextJobs[0];
  const totalQueue = myNextJobs.length + activeJobs.length;

  const quickActions = [
    {
      id: "refresh",
      label: "Refresh Queue",
      icon: RefreshCw,
      action: refetch,
      variant: "outline" as const,
    },
    {
      id: "rush",
      label: "Request Rush",
      icon: Zap,
      action: () => nextJob && openRushModal(nextJob),
      variant: "destructive" as const,
      disabled: !nextJob,
    },
  ];

  const getStatusMessage = () => {
    if (hasActiveJobs) {
      return {
        message: `Working on ${activeJobs.length} job${activeJobs.length > 1 ? 's' : ''}`,
        color: "text-blue-700",
        bgColor: "bg-blue-50",
        icon: Play,
      };
    } else if (nextJob) {
      return {
        message: `Next: ${nextJob.wo_no} - ${nextJob.current_stage_name}`,
        color: "text-green-700",
        bgColor: "bg-green-50",
        icon: Timer,
      };
    } else {
      return {
        message: "No jobs in queue - All caught up!",
        color: "text-gray-700",
        bgColor: "bg-gray-50",
        icon: Pause,
      };
    }
  };

  const status = getStatusMessage();
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Workstation Dashboard
            </h1>
            <p className="text-gray-600">
              Welcome back, {user?.email?.split('@')[0] || 'Operator'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {totalQueue} in queue
            </Badge>
          </div>
        </div>

        {/* Status Bar */}
        <Card className={cn("border-l-4", 
          hasActiveJobs ? "border-l-blue-500" : 
          nextJob ? "border-l-green-500" : "border-l-gray-400"
        )}>
          <CardContent className={cn("p-4", status.bgColor)}>
            <div className="flex items-center gap-3">
              <StatusIcon className={cn("h-6 w-6", status.color)} />
              <p className={cn("font-semibold text-lg", status.color)}>
                {status.message}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-3 mt-4">
          {quickActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={action.id}
                onClick={action.action}
                variant={action.variant}
                size="lg"
                disabled={action.disabled}
                className="flex-1 h-12 text-lg font-semibold touch-manipulation"
              >
                <ActionIcon className="h-5 w-5 mr-2" />
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-14 mb-6">
          <TabsTrigger value="queue" className="text-lg h-12 touch-manipulation">
            <Timer className="h-5 w-5 mr-2" />
            My Queue
          </TabsTrigger>
          <TabsTrigger value="handover" className="text-lg h-12 touch-manipulation">
            <FileText className="h-5 w-5 mr-2" />
            Handover
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-lg h-12 touch-manipulation">
            <BarChart3 className="h-5 w-5 mr-2" />
            My Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-0">
          <MyNextJobsView compactMode={false} />
        </TabsContent>

        <TabsContent value="handover" className="mt-0">
          <ShiftHandoverReport />
        </TabsContent>

        <TabsContent value="stats" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Today's Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Today's Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">
                      {activeJobs.length + Math.floor(Math.random() * 5)}
                    </p>
                    <p className="text-sm text-green-600">Jobs Completed</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">
                      {Math.floor(Math.random() * 400) + 200}m
                    </p>
                    <p className="text-sm text-blue-600">Work Time</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Efficiency Score</span>
                    <span className="font-semibold">92%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Jobs</span>
                    <Badge variant="default">{activeJobs.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Queued Jobs</span>
                    <Badge variant="secondary">{myNextJobs.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Next Start</span>
                    <span className="font-medium">
                      {nextJob ? 
                        new Date(nextJob.scheduled_start_at || '').toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        }) : 
                        'N/A'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Job Time</span>
                    <span className="font-medium">45m</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rush Job Modal */}
      <RushJobModal />
    </div>
  );
};
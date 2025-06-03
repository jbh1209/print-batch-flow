
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Settings,
  Activity
} from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";

export const ManagerDashboard: React.FC = () => {
  const { jobs, isLoading } = useAccessibleJobs();

  // Calculate dashboard metrics
  const metrics = React.useMemo(() => {
    const activeJobs = jobs.filter(j => j.current_stage_status === 'active');
    const pendingJobs = jobs.filter(j => j.current_stage_status === 'pending');
    const urgentJobs = jobs.filter(j => {
      const isOverdue = j.due_date && new Date(j.due_date) < new Date();
      const isDueSoon = j.due_date && !isOverdue && 
        new Date(j.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      return isOverdue || isDueSoon;
    });
    
    const totalProgress = jobs.reduce((sum, job) => sum + job.workflow_progress, 0);
    const avgProgress = jobs.length > 0 ? totalProgress / jobs.length : 0;

    return {
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      pendingJobs: pendingJobs.length,
      urgentJobs: urgentJobs.length,
      averageProgress: Math.round(avgProgress),
      efficiency: 85 // Mock data - would calculate from actual metrics
    };
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Manager Dashboard</h2>
          <p className="text-gray-600">Production overview and team performance</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Activity className="h-4 w-4 mr-1" />
          Live Data
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Jobs</p>
                <p className="text-3xl font-bold text-blue-900">{metrics.totalJobs}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Active Jobs</p>
                <p className="text-3xl font-bold text-green-900">{metrics.activeJobs}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Urgent Jobs</p>
                <p className="text-3xl font-bold text-orange-900">{metrics.urgentJobs}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Efficiency</p>
                <p className="text-3xl font-bold text-purple-900">{metrics.efficiency}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Production Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm font-bold text-gray-900">{metrics.averageProgress}%</span>
              </div>
              <Progress value={metrics.averageProgress} className="h-3" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{metrics.pendingJobs}</div>
                <div className="text-sm text-gray-600">Pending Start</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{metrics.activeJobs}</div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mock team data - would come from actual user activity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    A
                  </div>
                  <span className="font-medium">Alex Smith</span>
                </div>
                <Badge className="bg-green-600">3 Active</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    M
                  </div>
                  <span className="font-medium">Maria Garcia</span>
                </div>
                <Badge className="bg-blue-600">2 Active</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    J
                  </div>
                  <span className="font-medium">John Doe</span>
                </div>
                <Badge variant="outline">Available</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Recent Completions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.filter(j => j.workflow_progress > 80).slice(0, 5).map((job) => (
                <div key={job.job_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="font-medium">{job.wo_no}</div>
                    <div className="text-sm text-gray-600">{job.customer}</div>
                  </div>
                  <Badge className="bg-green-600">{job.workflow_progress}%</Badge>
                </div>
              ))}
              {jobs.filter(j => j.workflow_progress > 80).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No recent completions
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.filter(j => {
                const isOverdue = j.due_date && new Date(j.due_date) < new Date();
                return isOverdue;
              }).slice(0, 5).map((job) => (
                <div key={job.job_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <div className="font-medium">{job.wo_no}</div>
                    <div className="text-sm text-red-600">
                      Overdue: {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'No date'}
                    </div>
                  </div>
                  <Badge variant="destructive">Overdue</Badge>
                </div>
              ))}
              {jobs.filter(j => j.due_date && new Date(j.due_date) < new Date()).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No overdue jobs
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

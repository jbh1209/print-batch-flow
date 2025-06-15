import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  Package, 
  BarChart3, 
  FileSpreadsheet, 
  Settings,
  Filter,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Layers,
  Factory
} from "lucide-react";
import { DynamicProductionSidebar } from "./production/DynamicProductionSidebar";

interface ContextSidebarProps {
  activeTab: string;
  onFilterChange?: (filters: any) => void;
  // These three props only used for production tab:
  productionSidebarData?: { consolidatedStages: any[]; activeJobs: any[] };
  onStageSelect?: (stageId: string | null) => void;
  selectedStageId?: string | null;
}

export const ContextSidebar = ({
  activeTab, 
  onFilterChange,
  productionSidebarData,
  onStageSelect,
  selectedStageId
}: ContextSidebarProps) => {
  // Early return: never render for dashboard
  if (activeTab === 'dashboard') return null;

  const handleFilterChange = (filterType: string, value: any) => {
    if (onFilterChange) {
      onFilterChange({ [filterType]: value });
    }
  };

  const renderDashboardSidebar = () => (
    <Card className="compact-spacing">
      <CardHeader className="card-header-compact">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4" />
          Quick Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="card-content-compact">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-sm font-bold text-blue-600">142</div>
            <div className="text-xs text-gray-600">Active Jobs</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-sm font-bold text-green-600">28</div>
            <div className="text-xs text-gray-600">Completed</div>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs">On Schedule</span>
            <Badge variant="secondary" className="badge-compact">85%</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs">Overdue</span>
            <Badge variant="destructive" className="badge-compact">12</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderOrdersSidebar = () => (
    <Card className="compact-spacing">
      <CardHeader className="card-header-compact">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="card-content-compact">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="status-filter" className="text-xs">Status</Label>
            <Select onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="priority-filter" className="text-xs">Priority</Label>
            <Select onValueChange={(value) => handleFilterChange('priority', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="date-filter">Due Date</Label>
            <Select onValueChange={(value) => handleFilterChange('dueDate', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Due Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="search" className="text-xs">Search Jobs</Label>
            <Input 
              id="search"
              placeholder="Job number, customer..."
              className="input-compact"
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          <Separator />
          
          <div className="space-y-1">
            <Label className="text-xs">Quick Filters</Label>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Checkbox id="urgent" onCheckedChange={(checked) => handleFilterChange('urgent', checked)} />
                <Label htmlFor="urgent" className="text-xs">Urgent Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="my-jobs" onCheckedChange={(checked) => handleFilterChange('myJobs', checked)} />
                <Label htmlFor="my-jobs" className="text-xs">My Jobs</Label>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderProductionSidebar = () => {
    if (!productionSidebarData) return null;
    return (
      <DynamicProductionSidebar
        selectedStageId={selectedStageId}
        onStageSelect={onStageSelect || (() => {})}
        onFilterChange={onFilterChange}
        consolidatedStages={productionSidebarData.consolidatedStages}
        activeJobs={productionSidebarData.activeJobs}
      />
    );
  };

  const renderKanbanSidebar = () => (
    <Card className="compact-spacing">
      <CardHeader className="card-header-compact">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" />
          Kanban Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="card-content-compact">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">View Mode</Label>
            <Select defaultValue="all" onValueChange={(value) => handleFilterChange('viewMode', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="my-jobs">My Jobs Only</SelectItem>
                <SelectItem value="urgent">Urgent Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Group By</Label>
            <Select defaultValue="stage" onValueChange={(value) => handleFilterChange('groupBy', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stage">Production Stage</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="due-date">Due Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-2" />

          <div className="space-y-1">
            <Label className="text-xs">Quick Actions</Label>
            <div className="space-y-1">
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact">
                <CheckCircle className="h-3 w-3 mr-2" />
                Mark Complete
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact">
                <AlertCircle className="h-3 w-3 mr-2" />
                Report Issue
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact">
                <Clock className="h-3 w-3 mr-2" />
                Update Status
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderFactoryFloorSidebar = () => (
    <Card className="compact-spacing">
      <CardHeader className="card-header-compact">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Factory className="h-4 w-4" />
          Factory Floor
        </CardTitle>
      </CardHeader>
      <CardContent className="card-content-compact">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Department</Label>
            <Select onValueChange={(value) => handleFilterChange('department', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="printing">Printing</SelectItem>
                <SelectItem value="finishing">Finishing</SelectItem>
                <SelectItem value="quality">Quality Control</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Shift</Label>
            <Select onValueChange={(value) => handleFilterChange('shift', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue placeholder="Current Shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Shift</SelectItem>
                <SelectItem value="morning">Morning (6AM-2PM)</SelectItem>
                <SelectItem value="afternoon">Afternoon (2PM-10PM)</SelectItem>
                <SelectItem value="night">Night (10PM-6AM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-2" />

          <div className="space-y-1">
            <Label className="text-xs">Live Status</Label>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Active Operators
                </span>
                <Badge variant="secondary" className="badge-compact">12</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  On Break
                </span>
                <Badge variant="secondary" className="badge-compact">3</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Machine Issues
                </span>
                <Badge variant="secondary" className="badge-compact">1</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderWorksheetsSidebar = () => (
    <Card className="compact-spacing">
      <CardHeader className="card-header-compact">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="h-4 w-4" />
          Worksheets
        </CardTitle>
      </CardHeader>
      <CardContent className="card-content-compact">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Worksheet Type</Label>
            <Select onValueChange={(value) => handleFilterChange('worksheetType', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="quality">Quality Control</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Date Range</Label>
            <Select onValueChange={(value) => handleFilterChange('dateRange', value)}>
              <SelectTrigger className="input-compact">
                <SelectValue placeholder="This Week" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-2" />

          <div className="space-y-1">
            <Label className="text-xs">Quick Actions</Label>
            <div className="space-y-1">
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact">
                <FileSpreadsheet className="h-3 w-3 mr-2" />
                New Worksheet
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact">
                <Calendar className="h-3 w-3 mr-2" />
                Schedule Report
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSetupSidebar = () => (
    <Card className="compact-spacing">
      <CardHeader className="card-header-compact">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings className="h-4 w-4" />
          Administration
        </CardTitle>
      </CardHeader>
      <CardContent className="card-content-compact">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Quick Access</Label>
            <div className="space-y-1">
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact" asChild>
                <Link to="/tracker/users">
                  <Users className="h-3 w-3 mr-2" />
                  User Management
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact" asChild>
                <Link to="/tracker/admin?tab=production">
                  <Package className="h-3 w-3 mr-2" />
                  Product Categories
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start btn-compact">
                <Settings className="h-3 w-3 mr-2" />
                System Settings
              </Button>
            </div>
          </div>

          <Separator className="my-2" />

          <div className="space-y-1">
            <Label className="text-xs">System Status</Label>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Database
                </span>
                <Badge variant="secondary" className="badge-compact">Online</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Printers
                </span>
                <Badge variant="secondary" className="badge-compact">4/4</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Backup
                </span>
                <Badge variant="secondary" className="badge-compact">2h ago</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getSidebarContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboardSidebar();
      case 'orders':
        return renderOrdersSidebar();
      case 'production':
        return renderProductionSidebar();
      case 'kanban':
        return renderKanbanSidebar();
      case 'factory-floor':
        return renderFactoryFloorSidebar();
      case 'worksheets':
        return renderWorksheetsSidebar();
      case 'setup':
        return renderSetupSidebar();
      default:
        return renderDashboardSidebar();
    }
  };

  if (activeTab === 'production' && !productionSidebarData) return null;

  // Only apply vertical scroll, prevent horizontal scroll for sidebar
  return (
    <div
      className="w-64 min-w-[16rem] max-w-[17rem] border-r border-gray-200 bg-white p-3 overflow-y-auto"
      style={{ overflowX: "hidden" }}
    >
      {getSidebarContent()}
    </div>
  );
};
```

```typescript
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Settings,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Play
} from "lucide-react";

interface DynamicProductionSidebarProps {
  selectedStageId?: string;
  onStageSelect: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
  consolidatedStages: any[];
  activeJobs: any[];
}

export const DynamicProductionSidebar: React.FC<DynamicProductionSidebarProps> = ({ 
  selectedStageId,
  onStageSelect,
  onFilterChange,
  consolidatedStages,
  activeJobs
}) => {

  // Count jobs by stage using display names (master queue aware)
  const getJobCountForStage = (stageName: string) => {
    return activeJobs.filter(job => {
      const effectiveStageDisplay = job.display_stage_name || job.current_stage_name;
      return effectiveStageDisplay?.toLowerCase() === stageName.toLowerCase();
    }).length;
  };

  // Count jobs by status
  const getJobCountByStatus = (status: string) => {
    return activeJobs.filter(job => {
      switch (status) {
        case 'completed':
          return job.is_completed;
        case 'in-progress':
          return job.is_active;
        case 'pending':
          return job.is_pending;
        case 'overdue':
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          const today = new Date();
          return dueDate < today && !job.is_completed;
        default:
          return false;
      }
    }).length;
  };

  const handleStageClick = (stageId: string, stageName: string) => {
    if (selectedStageId === stageId) {
      onStageSelect(null);
      onFilterChange?.({ stage: null });
    } else {
      onStageSelect(stageId);
      onFilterChange?.({ stage: stageName });
    }
  };

  const handleAllJobsClick = () => {
    onStageSelect(null);
    onFilterChange?.({ stage: null });
  };

  const handleStatusFilter = (status: string) => {
    onStageSelect(null);
    onFilterChange?.({ status: status });
  };

  return (
    <div
      className="w-full"
      style={{ overflowY: "auto", overflowX: "hidden", maxWidth: "100%" }}
    >
      {/* Production Stages */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Production Queues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* All Jobs Button */}
          <Button 
            variant={!selectedStageId ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start text-xs h-8"
            onClick={handleAllJobsClick}
          >
            All Jobs
            <Badge variant="secondary" className="ml-auto text-xs">
              {activeJobs.length}
            </Badge>
          </Button>
          
          {/* Show consolidated stages */}
          {consolidatedStages
            .sort((a, b) => a.stage_name.localeCompare(b.stage_name))
            .map(stage => {
              const jobCount = getJobCountForStage(stage.stage_name);
              const isSelected = selectedStageId === stage.stage_id;
              
              return (
                <Button 
                  key={stage.stage_id}
                  variant={isSelected ? "default" : "ghost"} 
                  size="sm" 
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleStageClick(stage.stage_id, stage.stage_name)}
                >
                  <div 
                    className="w-2 h-2 rounded-full mr-2 flex-shrink-0" 
                    style={{ backgroundColor: stage.stage_color }}
                  />
                  <span className="truncate flex-1 text-left">
                    {stage.stage_name}
                    {stage.is_master_queue && stage.subsidiary_stages.length > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({stage.subsidiary_stages.length})
                      </span>
                    )}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {jobCount}
                  </Badge>
                </Button>
              );
            })}
        </CardContent>
      </Card>

      {/* Quick Status Filters */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Status Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
            { id: 'in-progress', label: 'In Progress', icon: Play, color: 'text-blue-500' },
            { id: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500' },
            { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-500' }
          ].map(status => (
            <Button 
              key={status.id}
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-xs h-8"
              onClick={() => handleStatusFilter(status.id)}
            >
              <status.icon className={`h-3 w-3 mr-2 ${status.color}`} />
              <span className="flex-1 text-left">{status.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {getJobCountByStatus(status.id)}
              </Badge>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Stage Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Stage Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start text-xs">
            <Plus className="h-3 w-3 mr-2" />
            Add Stage
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start text-xs">
            <Settings className="h-3 w-3 mr-2" />
            Configure Workflow
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

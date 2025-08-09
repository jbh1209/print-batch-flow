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
import { ProductionSidebar } from "./production/ProductionSidebar";

interface ContextSidebarProps {
  activeTab: string;
  onFilterChange?: (filters: any) => void;
  // These props only used for production tab:
  productionSidebarData?: { 
    consolidatedStages: any[]; 
    getJobCountForStage: (stageName: string) => number;
    getJobCountByStatus: (status: string) => number;
    totalActiveJobs: number;
  };
  onStageSelect?: (stageId: string | null, stageName: string | null) => void;
  selectedStageId?: string | null;
  selectedStageName?: string | null;
}

export const ContextSidebar = ({
  activeTab, 
  onFilterChange,
  productionSidebarData,
  onStageSelect,
  selectedStageId,
  selectedStageName
}: ContextSidebarProps) => {
  // Early return: never render for dashboard or production
  if (activeTab === 'dashboard' || activeTab === 'production') return null;

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
      <ProductionSidebar
        jobs={[]} // This will be passed from the actual production page
        consolidatedStages={productionSidebarData.consolidatedStages}
        selectedStageId={selectedStageId}
        selectedStageName={selectedStageName}
        onStageSelect={onStageSelect || (() => {})}
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


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

interface ContextSidebarProps {
  activeTab: string;
  onFilterChange?: (filters: any) => void;
}

export const ContextSidebar = ({ activeTab, onFilterChange }: ContextSidebarProps) => {
  const handleFilterChange = (filterType: string, value: any) => {
    if (onFilterChange) {
      onFilterChange({ [filterType]: value });
    }
  };

  const renderDashboardSidebar = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Quick Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-lg font-bold text-blue-600">142</div>
            <div className="text-xs text-gray-600">Active Jobs</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-lg font-bold text-green-600">28</div>
            <div className="text-xs text-gray-600">Completed</div>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">On Schedule</span>
            <Badge variant="secondary">85%</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Overdue</span>
            <Badge variant="destructive">12</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderOrdersSidebar = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select onValueChange={(value) => handleFilterChange('status', value)}>
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label htmlFor="priority-filter">Priority</Label>
          <Select onValueChange={(value) => handleFilterChange('priority', value)}>
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label htmlFor="date-filter">Due Date</Label>
          <Select onValueChange={(value) => handleFilterChange('dueDate', value)}>
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label htmlFor="search">Search Jobs</Label>
          <Input 
            id="search"
            placeholder="Job number, customer..."
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <Separator />
        
        <div className="space-y-2">
          <Label>Quick Filters</Label>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Checkbox id="urgent" onCheckedChange={(checked) => handleFilterChange('urgent', checked)} />
              <Label htmlFor="urgent" className="text-sm">Urgent Only</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="my-jobs" onCheckedChange={(checked) => handleFilterChange('myJobs', checked)} />
              <Label htmlFor="my-jobs" className="text-sm">My Jobs</Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderProductionSidebar = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Production Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Design
            </span>
            <Badge variant="secondary">24</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              Printing
            </span>
            <Badge variant="secondary">18</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              Finishing
            </span>
            <Badge variant="secondary">12</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              Quality Check
            </span>
            <Badge variant="secondary">8</Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Filter by Stage</Label>
          <Select onValueChange={(value) => handleFilterChange('stage', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="design">Design</SelectItem>
              <SelectItem value="printing">Printing</SelectItem>
              <SelectItem value="finishing">Finishing</SelectItem>
              <SelectItem value="quality">Quality Check</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Filter by Operator</Label>
          <Select onValueChange={(value) => handleFilterChange('operator', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Operators" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Operators</SelectItem>
              <SelectItem value="john">John Smith</SelectItem>
              <SelectItem value="sarah">Sarah Johnson</SelectItem>
              <SelectItem value="mike">Mike Wilson</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );

  const renderKanbanSidebar = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Kanban Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>View Mode</Label>
          <Select defaultValue="all" onValueChange={(value) => handleFilterChange('viewMode', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="my-jobs">My Jobs Only</SelectItem>
              <SelectItem value="urgent">Urgent Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Group By</Label>
          <Select defaultValue="stage" onValueChange={(value) => handleFilterChange('groupBy', value)}>
            <SelectTrigger>
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

        <Separator />

        <div className="space-y-2">
          <Label>Quick Actions</Label>
          <div className="space-y-1">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <AlertCircle className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Clock className="h-4 w-4 mr-2" />
              Update Status
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderFactoryFloorSidebar = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Factory Floor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Department</Label>
          <Select onValueChange={(value) => handleFilterChange('department', value)}>
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label>Shift</Label>
          <Select onValueChange={(value) => handleFilterChange('shift', value)}>
            <SelectTrigger>
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

        <Separator />

        <div className="space-y-2">
          <Label>Live Status</Label>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Active Operators
              </span>
              <Badge variant="secondary">12</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                On Break
              </span>
              <Badge variant="secondary">3</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                Machine Issues
              </span>
              <Badge variant="secondary">1</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderWorksheetsSidebar = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Worksheets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Worksheet Type</Label>
          <Select onValueChange={(value) => handleFilterChange('worksheetType', value)}>
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label>Date Range</Label>
          <Select onValueChange={(value) => handleFilterChange('dateRange', value)}>
            <SelectTrigger>
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

        <Separator />

        <div className="space-y-2">
          <Label>Quick Actions</Label>
          <div className="space-y-1">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              New Worksheet
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Report
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSetupSidebar = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Administration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Quick Access</Label>
          <div className="space-y-1">
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <Link to="/tracker/users">
                <Users className="h-4 w-4 mr-2" />
                User Management
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Package className="h-4 w-4 mr-2" />
              Product Categories
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              System Settings
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>System Status</Label>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Database
              </span>
              <Badge variant="secondary">Online</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Printers
              </span>
              <Badge variant="secondary">4/4</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                Backup
              </span>
              <Badge variant="secondary">2h ago</Badge>
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

  return (
    <div className="w-80 border-r border-gray-200 bg-white p-4 overflow-y-auto">
      {getSidebarContent()}
    </div>
  );
};

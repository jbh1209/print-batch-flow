
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Filter, 
  Calendar, 
  User, 
  Package, 
  Settings,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Download,
  Upload,
  QrCode
} from "lucide-react";

interface ContextSidebarProps {
  activeTab: string;
  onFilterChange?: (filters: any) => void;
}

export const ContextSidebar: React.FC<ContextSidebarProps> = ({ 
  activeTab, 
  onFilterChange 
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const handleFilterToggle = (filter: string) => {
    const newFilters = selectedFilters.includes(filter)
      ? selectedFilters.filter(f => f !== filter)
      : [...selectedFilters, filter];
    
    setSelectedFilters(newFilters);
    onFilterChange?.({ search: searchQuery, filters: newFilters });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onFilterChange?.({ search: value, filters: selectedFilters });
  };

  const renderOrdersContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4" />
            Quick Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search jobs, customers..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Status Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500', count: 12 },
            { id: 'in-progress', label: 'In Progress', icon: Play, color: 'text-blue-500', count: 8 },
            { id: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500', count: 15 },
            { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-500', count: 3 }
          ].map(status => (
            <Button 
              key={status.id}
              variant={selectedFilters.includes(status.id) ? "default" : "ghost"} 
              size="sm" 
              className="w-full justify-start"
              onClick={() => handleFilterToggle(status.id)}
            >
              <status.icon className={`h-4 w-4 mr-2 ${status.color}`} />
              {status.label} 
              <Badge variant="secondary" className="ml-auto">{status.count}</Badge>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Due Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { id: 'today', label: 'Due Today', count: 2, variant: 'destructive' as const },
            { id: 'week', label: 'This Week', count: 7, variant: 'secondary' as const },
            { id: 'next-week', label: 'Next Week', count: 12, variant: 'secondary' as const }
          ].map(period => (
            <Button 
              key={period.id}
              variant={selectedFilters.includes(period.id) ? "default" : "ghost"} 
              size="sm" 
              className="w-full justify-start"
              onClick={() => handleFilterToggle(period.id)}
            >
              {period.label} 
              <Badge variant={period.variant} className="ml-auto">{period.count}</Badge>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Upload className="h-4 w-4 mr-2" />
            Import Jobs
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <QrCode className="h-4 w-4 mr-2" />
            Print QR Labels
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderProductionContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Production Stages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { id: 'pre-press', label: 'Pre-Press', count: 5, color: '#8B5CF6' },
            { id: 'printing', label: 'Printing', count: 3, color: '#3B82F6' },
            { id: 'finishing', label: 'Finishing', count: 7, color: '#10B981' },
            { id: 'quality', label: 'Quality Check', count: 2, color: '#F59E0B' },
            { id: 'packaging', label: 'Packaging', count: 4, color: '#EF4444' }
          ].map(stage => (
            <Button 
              key={stage.id}
              variant={selectedFilters.includes(stage.id) ? "default" : "ghost"} 
              size="sm" 
              className="w-full justify-start"
              onClick={() => handleFilterToggle(stage.id)}
            >
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: stage.color }}
              />
              {stage.label}
              <Badge variant="secondary" className="ml-auto">{stage.count}</Badge>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipment Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: 'Press 1', status: 'Active', color: 'bg-green-500' },
            { name: 'Press 2', status: 'Idle', color: 'bg-gray-400' },
            { name: 'Cutter A', status: 'Active', color: 'bg-green-500' },
            { name: 'Laminator', status: 'Maintenance', color: 'bg-red-500' },
            { name: 'Folder', status: 'Active', color: 'bg-green-500' }
          ].map((equipment, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
              <span className="text-sm font-medium">{equipment.name}</span>
              <Badge className={`text-white ${equipment.color}`}>
                {equipment.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Production Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            Workflow Efficiency
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Bottleneck Analysis
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Stage Timing Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderKanbanContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Board Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            variant={selectedFilters.includes('group-status') ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start"
            onClick={() => handleFilterToggle('group-status')}
          >
            Group by Status
          </Button>
          <Button 
            variant={selectedFilters.includes('group-category') ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start"
            onClick={() => handleFilterToggle('group-category')}
          >
            Group by Category
          </Button>
          <Button 
            variant={selectedFilters.includes('group-priority') ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start"
            onClick={() => handleFilterToggle('group-priority')}
          >
            Group by Priority
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">View Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            Compact View
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Detailed View
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Timeline View
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Board Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Export Board
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Configure Columns
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderWorksheetsContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Worksheet Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            Daily Production
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Quality Control
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Time Tracking
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Material Usage
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Generate Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Daily Summary
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Weekly Report
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Monthly Analysis
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderSetupContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Categories
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Production Stages
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <User className="h-4 w-4 mr-2" />
            User Management
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Package className="h-4 w-4 mr-2" />
            Equipment Setup
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Backup Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Database</span>
            <Badge className="bg-green-500 text-white">Online</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">QR Scanner</span>
            <Badge className="bg-green-500 text-white">Ready</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Real-time Sync</span>
            <Badge className="bg-green-500 text-white">Active</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const getContent = () => {
    switch (activeTab) {
      case "orders":
        return renderOrdersContent();
      case "production":
        return renderProductionContent();
      case "kanban":
        return renderKanbanContent();
      case "worksheets":
        return renderWorksheetsContent();
      case "setup":
        return renderSetupContent();
      default:
        return renderOrdersContent();
    }
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-800 mb-2">
          {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tools
        </h3>
        <Separator />
      </div>
      {getContent()}
    </div>
  );
};

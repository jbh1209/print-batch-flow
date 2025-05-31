
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle
} from "lucide-react";

interface ContextSidebarProps {
  activeTab: string;
  onFilterChange?: (filters: any) => void;
}

export const ContextSidebar: React.FC<ContextSidebarProps> = ({ 
  activeTab, 
  onFilterChange 
}) => {
  const renderOrdersContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Status Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Completed <Badge variant="secondary" className="ml-auto">12</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Play className="h-4 w-4 mr-2 text-blue-500" />
            In Progress <Badge variant="secondary" className="ml-auto">8</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Clock className="h-4 w-4 mr-2 text-yellow-500" />
            Pending <Badge variant="secondary" className="ml-auto">15</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
            Overdue <Badge variant="secondary" className="ml-auto">3</Badge>
          </Button>
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
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Today <Badge variant="destructive" className="ml-auto">2</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            This Week <Badge variant="secondary" className="ml-auto">7</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Next Week <Badge variant="secondary" className="ml-auto">12</Badge>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Customers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-left">
            ABC Corp <Badge variant="outline" className="ml-auto">5</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-left">
            XYZ Ltd <Badge variant="outline" className="ml-auto">3</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-left">
            Demo Inc <Badge variant="outline" className="ml-auto">2</Badge>
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
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Pre-Press <Badge variant="secondary" className="ml-auto">5</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Printing <Badge variant="secondary" className="ml-auto">3</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Finishing <Badge variant="secondary" className="ml-auto">7</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Quality Check <Badge variant="secondary" className="ml-auto">2</Badge>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Packaging <Badge variant="secondary" className="ml-auto">4</Badge>
          </Button>
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
          <div className="flex items-center justify-between">
            <span className="text-sm">Press 1</span>
            <Badge variant="default" className="bg-green-500">Active</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Press 2</span>
            <Badge variant="secondary">Idle</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Cutter A</span>
            <Badge variant="default" className="bg-green-500">Active</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Laminator</span>
            <Badge variant="destructive">Maintenance</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderKanbanContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Board View Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Group by Status
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Group by Category
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Group by Priority
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
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Daily Production
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Quality Reports
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Time Tracking
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderSetupContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Administration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Categories
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Production Stages
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            User Management
          </Button>
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
      {getContent()}
    </div>
  );
};

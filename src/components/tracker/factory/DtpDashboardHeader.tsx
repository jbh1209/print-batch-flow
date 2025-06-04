
import React from "react";
import { Button } from "@/components/ui/button";
import { 
  LogOut,
  Menu,
  Home,
  BarChart3,
  Settings,
  FileText
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DtpDashboardHeaderProps {
  onNavigation: (path: string) => void;
  onLogout: () => void;
}

export const DtpDashboardHeader: React.FC<DtpDashboardHeaderProps> = ({
  onNavigation,
  onLogout
}) => {
  return (
    <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu className="h-4 w-4 mr-2" />
              Menu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onNavigation('/tracker/dashboard')}>
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigation('/tracker/kanban')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Production Kanban
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigation('/tracker/jobs')}>
              <FileText className="h-4 w-4 mr-2" />
              All Jobs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigation('/tracker/admin')}>
              <Settings className="h-4 w-4 mr-2" />
              Admin Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div>
          <h1 className="text-2xl font-bold">DTP Workstation</h1>
          <p className="text-gray-600">DTP and Proofing jobs</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          onClick={onLogout}
          className="h-10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};

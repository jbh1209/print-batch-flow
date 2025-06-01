
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Upload,
  Kanban,
  Table,
  FileSpreadsheet,
  Home,
  ChevronLeft,
  Package2,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

const NavItem = ({ to, icon, label, isActive }: NavItemProps) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center px-4 py-2 text-sm font-medium rounded-md",
        isActive 
          ? "bg-white/10 text-white" 
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <div className="mr-3">{icon}</div>
      <span>{label}</span>
    </Link>
  );
};

const TrackerSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { isAdmin } = useAdminAuth();

  return (
    <div className={cn(
      "bg-green-600 text-white flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && (
          <div>
            <h1 className="text-xl font-bold">Tracker</h1>
            <p className="text-xs text-white/70">Production Management</p>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-full hover:bg-white/10"
        >
          <ChevronLeft size={18} className={cn(
            "transition-transform",
            collapsed ? "rotate-180" : ""
          )} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-2">
        <nav className="flex flex-col gap-1">
          <NavItem 
            to="/tracker" 
            icon={<LayoutDashboard size={20} />} 
            label={collapsed ? "" : "Dashboard"} 
            isActive={location.pathname === "/tracker"} 
          />
          <NavItem 
            to="/tracker/upload" 
            icon={<Upload size={20} />} 
            label={collapsed ? "" : "Upload Excel"} 
            isActive={location.pathname === "/tracker/upload"} 
          />
          <NavItem 
            to="/tracker/kanban" 
            icon={<Kanban size={20} />} 
            label={collapsed ? "" : "Kanban Board"} 
            isActive={location.pathname === "/tracker/kanban"} 
          />
          <NavItem 
            to="/tracker/jobs" 
            icon={<Table size={20} />} 
            label={collapsed ? "" : "Jobs Table"} 
            isActive={location.pathname === "/tracker/jobs"} 
          />
          <NavItem 
            to="/tracker/worksheets" 
            icon={<FileSpreadsheet size={20} />} 
            label={collapsed ? "" : "Work Sheets"} 
            isActive={location.pathname === "/tracker/worksheets"} 
          />
          
          {isAdmin && (
            <>
              <div className="border-t border-white/10 my-2"></div>
              <NavItem 
                to="/tracker/admin" 
                icon={<Settings size={20} />} 
                label={collapsed ? "" : "Administration"} 
                isActive={location.pathname === "/tracker/admin"} 
              />
              <NavItem 
                to="/tracker/users" 
                icon={<Users size={20} />} 
                label={collapsed ? "" : "Users"} 
                isActive={location.pathname === "/tracker/users"} 
              />
            </>
          )}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <Button 
          asChild 
          variant="outline" 
          size="sm" 
          className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <Link to="/" className="flex items-center gap-2">
            <Home size={16} />
            {!collapsed && "Switch Apps"}
          </Link>
        </Button>
        {!collapsed && (
          <Button 
            asChild 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Link to="/batchflow" className="flex items-center gap-2">
              <Package2 size={16} />
              BatchFlow
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default TrackerSidebar;

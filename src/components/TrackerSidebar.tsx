
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { 
  LayoutDashboard, 
  Package, 
  BarChart3, 
  FileSpreadsheet, 
  Layers,
  Factory,
  Settings,
  Users
} from "lucide-react";

const TrackerSidebar = () => {
  const location = useLocation();
  const { userRole } = useUserRole();
  
  const navigation = [
    { name: "Dashboard", href: "/tracker", icon: LayoutDashboard },
    { name: "Production", href: "/tracker/production", icon: Package },
    { name: "Kanban", href: "/tracker/kanban", icon: Layers },
    { 
      name: userRole === 'dtp_operator' ? "DTP Workflow" : "Factory Floor", 
      href: userRole === 'dtp_operator' ? "/tracker/dtp-workflow" : "/tracker/factory-floor", 
      icon: Factory 
    },
    { name: "Analytics", href: "/tracker/analytics", icon: BarChart3 },
    { name: "Worksheets", href: "/tracker/worksheets", icon: FileSpreadsheet },
    { name: "Users", href: "/tracker/users", icon: Users },
    { name: "Admin", href: "/tracker/admin", icon: Settings },
  ];

  return (
    <nav className="space-y-1 px-2 py-4">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
              isActive
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon
              className={cn(
                "mr-3 h-5 w-5 flex-shrink-0",
                isActive ? "text-gray-500" : "text-gray-400 group-hover:text-gray-500"
              )}
            />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
};

export default TrackerSidebar;

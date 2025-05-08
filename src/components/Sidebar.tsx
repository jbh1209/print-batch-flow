
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Layers, 
  CreditCard, 
  FileText, 
  Package, 
  Box, 
  Sticker, 
  Book, 
  Image, 
  Users, 
  Settings, 
  ChevronLeft,
  Mail,
  ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isHeading?: boolean;
}

const NavItem = ({ to, icon, label, isActive, isHeading = false }: NavItemProps) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center px-4 py-2 text-sm font-medium rounded-md",
        isActive 
          ? "bg-white/10 text-white" 
          : "text-white/70 hover:bg-white/10 hover:text-white",
        isHeading ? "text-xs uppercase tracking-wider text-white/50 py-1" : ""
      )}
    >
      <div className="mr-3">{icon}</div>
      <span>{label}</span>
    </Link>
  );
};

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Enhanced route active detection
  const isRouteActive = (path: string): boolean => {
    // For root path, only match exact path
    if (path === "/" && location.pathname === "/") {
      return true;
    }
    
    // For other paths, match if the current path starts with the given path
    // but make sure we're matching complete segments
    if (path !== "/" && location.pathname.startsWith(path)) {
      // Check if it's an exact match or if the next character is a slash
      // or if we're at the end of the path
      if (
        location.pathname === path ||
        location.pathname.charAt(path.length) === "/" ||
        path.charAt(path.length - 1) === "/"
      ) {
        return true;
      }
    }
    
    return false;
  };
  
  // Debug the current route
  console.log("Current Path:", location.pathname);

  return (
    <div className={cn(
      "bg-batchflow-primary text-white flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && <h1 className="text-xl font-bold">BatchFlow</h1>}
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
        {!collapsed && <div className="mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">General</div>}
        <nav className="flex flex-col gap-1">
          <NavItem 
            to="/" 
            icon={<LayoutDashboard size={20} />} 
            label={collapsed ? "" : "Dashboard"} 
            isActive={isRouteActive("/")} 
          />
          <NavItem 
            to="/all-jobs" 
            icon={<ClipboardList size={20} />} 
            label={collapsed ? "" : "All Jobs"} 
            isActive={isRouteActive("/all-jobs")} 
          />
          <NavItem 
            to="/batches" 
            icon={<Layers size={20} />} 
            label={collapsed ? "" : "All Batches"} 
            isActive={isRouteActive("/batches") && !location.pathname.includes("/batches/")} 
          />
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Batch Types</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          <NavItem 
            to="/batches/business-cards" 
            icon={<CreditCard size={20} />} 
            label={collapsed ? "" : "Business Cards"} 
            isActive={isRouteActive("/batches/business-cards")} 
          />
          <NavItem 
            to="/batches/flyers" 
            icon={<FileText size={20} />} 
            label={collapsed ? "" : "Flyers"} 
            isActive={isRouteActive("/batches/flyers")} 
          />
          <NavItem 
            to="/batches/postcards" 
            icon={<Mail size={20} />} 
            label={collapsed ? "" : "Postcards"} 
            isActive={isRouteActive("/batches/postcards")} 
          />
          <NavItem 
            to="/batches/sleeves" 
            icon={<Package size={20} />} 
            label={collapsed ? "" : "Shipper Box Sleeves"} 
            isActive={isRouteActive("/batches/sleeves")} 
          />
          <NavItem 
            to="/batches/boxes" 
            icon={<Box size={20} />} 
            label={collapsed ? "" : "Product Boxes"} 
            isActive={isRouteActive("/batches/boxes")} 
          />
          <NavItem 
            to="/batches/stickers" 
            icon={<Sticker size={20} />} 
            label={collapsed ? "" : "Zund Stickers"} 
            isActive={isRouteActive("/batches/stickers")} 
          />
          <NavItem 
            to="/batches/covers" 
            icon={<Book size={20} />} 
            label={collapsed ? "" : "Covers"} 
            isActive={isRouteActive("/batches/covers")} 
          />
          <NavItem 
            to="/batches/posters" 
            icon={<Image size={20} />} 
            label={collapsed ? "" : "Posters"} 
            isActive={isRouteActive("/batches/posters")} 
          />
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Administration</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          <NavItem 
            to="/users" 
            icon={<Users size={20} />} 
            label={collapsed ? "" : "Users"} 
            isActive={isRouteActive("/users")} 
          />
          <NavItem 
            to="/settings" 
            icon={<Settings size={20} />} 
            label={collapsed ? "" : "Settings"} 
            isActive={isRouteActive("/settings")} 
          />
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
